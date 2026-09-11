// Real HLS transcoder using ffmpeg. Produces an adaptive ladder (240p–1080p) as
// fMP4/TS HLS + a master playlist into local storage, then the asset is served by
// the local origin (range-served, cached). If ffmpeg is missing it degrades to a
// passthrough so the app still runs.
//
// In production this runs on a worker queue (BullMQ/SQS) off the request path;
// here it runs as an in-process background job. The public contract — a VideoAsset
// that moves UPLOADING → PROCESSING → READY with an hlsPath — is identical.
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

export interface Rendition {
  name: string;
  height: number;
  vBitrateK: number; // kbps
  aBitrateK: number;
}

// Standard OTT ladder. Only renditions with height <= source height are produced.
const LADDER: Rendition[] = [
  { name: "240p", height: 240, vBitrateK: 400, aBitrateK: 64 },
  { name: "360p", height: 360, vBitrateK: 800, aBitrateK: 96 },
  { name: "480p", height: 480, vBitrateK: 1400, aBitrateK: 128 },
  { name: "720p", height: 720, vBitrateK: 2800, aBitrateK: 128 },
  { name: "1080p", height: 1080, vBitrateK: 5000, aBitrateK: 192 },
];

export function ffmpegBin() {
  return env.ffmpegPath || "ffmpeg";
}
export function ffprobeBin() {
  return env.ffprobePath || "ffprobe";
}

function run(bin: string, args: string[], onStderr?: (s: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let err = "";
    p.stderr.on("data", (d) => {
      const s = d.toString();
      err += s;
      onStderr?.(s);
    });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}: ${err.slice(-500)}`)),
    );
  });
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await run(ffmpegBin(), ["-version"]);
    return true;
  } catch {
    return false;
  }
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);
// Flags needed when ffmpeg/ffprobe read a remote URL (HLS over https).
const URL_INPUT_FLAGS = [
  "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
  "-reconnect", "1",
  "-reconnect_streamed", "1",
  "-reconnect_delay_max", "5",
];

async function probe(input: string): Promise<{ height: number; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffprobeBin(), [
      "-v", "error",
      ...(isUrl(input) ? ["-protocol_whitelist", "file,http,https,tcp,tls,crypto"] : []),
      "-select_streams", "v:0",
      "-show_entries", "stream=height",
      "-show_entries", "format=duration",
      "-of", "json",
      input,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", reject);
    p.on("close", () => {
      try {
        const j = JSON.parse(out);
        resolve({
          height: Number(j.streams?.[0]?.height ?? 720),
          durationSec: Math.round(Number(j.format?.duration ?? 0)),
        });
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}

// Transcode a source file into an HLS ladder under storage/hls/<assetId>/.
// Updates the VideoAsset row's status/progress as it goes.
export async function transcodeToHls(
  assetId: string,
  sourcePath: string,
  opts: { wasPlayable?: boolean; prevStreamUrl?: string | null } = {},
): Promise<void> {
  const outDir = path.join(env.storageLocalDir, "hls", assetId);
  await fsp.mkdir(outDir, { recursive: true });

  try {
    const { height: srcHeight, durationSec } = await probe(sourcePath);
    const chosen = LADDER.filter((r) => r.height <= srcHeight);
    if (chosen.length === 0) chosen.push(LADDER[0]);

    // One ffmpeg invocation producing every rendition + a master playlist.
    // Split the source video into N branches and scale each; map a copy of the
    // audio to every variant.
    const n = chosen.length;
    const splitLabels = chosen.map((_, i) => `[v${i}]`).join("");
    const scaleChain = chosen
      .map((r, i) => `[v${i}]scale=w=-2:h=${r.height}[v${i}out]`)
      .join("; ");
    const filter = `[0:v]split=${n}${splitLabels}; ${scaleChain}`;

    const args: string[] = [
      "-y",
      ...(isUrl(sourcePath) ? URL_INPUT_FLAGS : []),
      "-i", sourcePath,
      "-filter_complex", filter,
    ];
    const varStream: string[] = [];
    chosen.forEach((r, i) => {
      args.push("-map", `[v${i}out]`, "-map", "0:a:0?");
      args.push(
        `-c:v:${i}`, "libx264", "-preset", "veryfast", "-g", "48", "-sc_threshold", "0",
        `-b:v:${i}`, `${r.vBitrateK}k`, `-maxrate:v:${i}`, `${Math.round(r.vBitrateK * 1.07)}k`, `-bufsize:v:${i}`, `${r.vBitrateK * 2}k`,
        `-c:a:${i}`, "aac", `-b:a:${i}`, `${r.aBitrateK}k`, "-ac", "2",
      );
      varStream.push(`v:${i},a:${i},name:${r.name}`);
    });
    args.push(
      "-f", "hls",
      "-hls_time", "4",
      "-hls_playlist_type", "vod",
      "-hls_segment_type", "mpegts",
      "-master_pl_name", "master.m3u8",
      "-hls_segment_filename", path.join(outDir, "%v_seg%03d.ts"),
      "-var_stream_map", varStream.join(" "),
      path.join(outDir, "%v.m3u8"),
    );

    let lastPct = 0;
    await run(ffmpegBin(), args, (s) => {
      // Parse "time=HH:MM:SS.xx" to a rough progress percentage.
      const m = /time=(\d+):(\d+):(\d+)/.exec(s);
      if (m && durationSec > 0) {
        const secs = +m[1] * 3600 + +m[2] * 60 + +m[3];
        const pct = Math.min(99, Math.round((secs / durationSec) * 100));
        if (pct >= lastPct + 5) {
          lastPct = pct;
          prisma.videoAsset
            .update({ where: { id: assetId }, data: { renditions: { progress: pct } as never } })
            .catch(() => {});
        }
      }
    });

    // Master is served by the streaming origin at /streaming/local/<assetId>/master.m3u8
    const hlsPath = `hls/${assetId}/master.m3u8`;
    const streamUrl = `${env.apiPublicUrl}/streaming/local/${assetId}/master.m3u8`;
    await prisma.videoAsset.update({
      where: { id: assetId },
      data: {
        status: "READY",
        hlsPath,
        streamUrl,
        durationSec,
        renditions: chosen.map((r) => ({ height: r.height, bandwidth: r.vBitrateK * 1000 })) as never,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[transcode] asset ${assetId} failed`, e);
    // Never leave a previously-playable title broken: restore its original stream.
    await prisma.videoAsset
      .update({
        where: { id: assetId },
        data: opts.wasPlayable
          ? { status: "READY", streamUrl: opts.prevStreamUrl ?? undefined, renditions: undefined as never }
          : { status: "FAILED" },
      })
      .catch(() => {});
    // Clean partial output.
    fs.rm(outDir, { recursive: true, force: true }, () => {});
  }
}
