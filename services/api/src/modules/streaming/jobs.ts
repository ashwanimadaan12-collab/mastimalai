// Glue between the CMS and the transcoder: attach a VideoAsset to a movie/episode,
// mark it PROCESSING, and kick off the (in-process, background) transcode job.
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ffmpegBin, transcodeToHls } from "./transcode.js";

const uploadDir = path.join(env.storageLocalDir, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Ensure the content item has a VideoAsset row; return its id.
async function ensureAsset(kind: "movie" | "episode", contentId: string): Promise<string> {
  if (kind === "movie") {
    const m = await prisma.movie.findUnique({ where: { id: contentId }, select: { videoAssetId: true } });
    if (m?.videoAssetId) return m.videoAssetId;
    const asset = await prisma.videoAsset.create({ data: { status: "UPLOADING" } });
    await prisma.movie.update({ where: { id: contentId }, data: { videoAssetId: asset.id } });
    return asset.id;
  }
  const e = await prisma.episode.findUnique({ where: { id: contentId }, select: { videoAssetId: true } });
  if (e?.videoAssetId) return e.videoAssetId;
  const asset = await prisma.videoAsset.create({ data: { status: "UPLOADING" } });
  await prisma.episode.update({ where: { id: contentId }, data: { videoAssetId: asset.id } });
  return asset.id;
}

// Stream a raw request body to a source file (no full buffering), size-capped.
export function saveRawUpload(
  req: NodeJS.ReadableStream,
  destPath: string,
  maxBytes: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const ws = fs.createWriteStream(destPath);
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        ws.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error("Upload exceeds size limit"));
      }
    });
    req.pipe(ws);
    ws.on("finish", () => resolve(bytes));
    ws.on("error", reject);
  });
}

// Register a source against a content item and start transcoding in the
// background. NON-DESTRUCTIVE: if the title already has a playable stream, it keeps
// playing (original URL untouched) until the transcode succeeds, then swaps to the
// local ladder. A failed transcode leaves the original stream intact.
export async function startTranscode(
  kind: "movie" | "episode",
  contentId: string,
  sourcePath: string,
): Promise<string> {
  const assetId = await ensureAsset(kind, contentId);
  const asset = await prisma.videoAsset.findUnique({ where: { id: assetId } });
  const wasPlayable = asset?.status === "READY" && !!asset.streamUrl;

  await prisma.videoAsset.update({
    where: { id: assetId },
    data: {
      sourcePath,
      // Only flip to PROCESSING when there's nothing to play yet. A playable
      // title stays READY on its current URL while the ladder builds.
      ...(wasPlayable ? {} : { status: "PROCESSING" }),
    },
  });

  // Fire-and-forget: real deployments push this onto a worker queue instead.
  void transcodeToHls(assetId, sourcePath, {
    wasPlayable,
    prevStreamUrl: asset?.streamUrl ?? null,
  });
  return assetId;
}

// Generate a short synthetic test clip with ffmpeg (colour bars + tone) so the
// pipeline can be exercised end-to-end without uploading a real file.
export function generateSample(destPath: string, seconds = 20, height = 720): Promise<void> {
  const width = Math.round((height * 16) / 9);
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-f", "lavfi", "-i", `testsrc=size=${width}x${height}:rate=25:duration=${seconds}`,
      "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest",
      destPath,
    ];
    const p = spawn(ffmpegBin(), args);
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-400)))));
  });
}

export { uploadDir };
export async function cleanupSource(assetId: string) {
  const asset = await prisma.videoAsset.findUnique({ where: { id: assetId }, select: { sourcePath: true } });
  if (asset?.sourcePath) await fsp.unlink(asset.sourcePath).catch(() => {});
}
