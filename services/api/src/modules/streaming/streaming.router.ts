// Streaming edge/origin for dev (the "CDN" layer). It reverse-proxies an upstream
// HLS stream through the API: manifests are rewritten so every variant/segment is
// fetched via this server, and segments are cached to disk (range-served, long
// max-age). Result: repeat plays + seeking are disk-fast, and delivery is signed.
//
// In production this whole module is replaced by a real CDN in front of S3; the
// player contract (a signed master URL from /playback/token) stays identical.
import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { forbidden, badRequest, wrap } from "../../lib/http.js";
import { verifyPlayback, signUrl, verifyUrlSig } from "../playback/token.js";
import { safeUpstreamUrl as hostAllowed } from "./ssrf.js";

export const streamingRouter = Router();

fs.mkdirSync(env.streamCacheDir, { recursive: true });

// Build a RELATIVE proxied URL. HLS players resolve child URIs against the
// manifest's own location, so relative keeps everything host-agnostic — the same
// stream works from a browser (localhost), an Android emulator (10.0.2.2), a real
// device (LAN IP) or a deployed domain, with no server-side host config.
function proxied(kind: "media" | "seg", absUrl: string, token: string): string {
  const qs = new URLSearchParams({ u: absUrl, s: signUrl(absUrl), token });
  return `${kind === "media" ? "media.m3u8" : "seg"}?${qs.toString()}`;
}

// Rewrite an HLS manifest: resolve every URI against `base`, replace with a proxy
// URL. Variant streams -> media.m3u8 proxy; segments/keys/map -> seg proxy.
function rewriteManifest(text: string, base: string, token: string, isMaster: boolean): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#")) {
      // Rewrite URI="..." attributes (EXT-X-MEDIA, EXT-X-KEY, EXT-X-MAP).
      const rewritten = line.replace(/URI="([^"]+)"/g, (_m, uri) => {
        const abs = new URL(uri, base).toString();
        const kind = /EXT-X-MEDIA/.test(line) ? "media" : "seg";
        return `URI="${proxied(kind, abs, token)}"`;
      });
      out.push(rewritten);
      continue;
    }
    if (line.trim() === "") {
      out.push(line);
      continue;
    }
    // A bare URI line: a variant playlist (in a master) or a segment (in media).
    const abs = new URL(line.trim(), base).toString();
    out.push(proxied(isMaster ? "media" : "seg", abs, token));
  }
  return out.join("\n");
}

function looksLikeMaster(text: string): boolean {
  return /#EXT-X-STREAM-INF/.test(text);
}

// GET /streaming/master.m3u8?token=  — entry point (URL handed to the player).
streamingRouter.get(
  "/master.m3u8",
  wrap(async (req, res) => {
    const token = String(req.query.token ?? "");
    const payload = verifyPlayback(token);
    if (!payload) throw forbidden("Invalid or expired playback token");
    const upstream = payload.streamUrl;
    if (!(await hostAllowed(upstream))) throw forbidden("Upstream host not allowed");

    const r = await fetch(upstream);
    if (!r.ok) throw badRequest(`Upstream manifest ${r.status}`);
    const text = await r.text();
    const master = looksLikeMaster(text);
    const body = rewriteManifest(text, upstream, token, master);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store"); // manifests are cheap; keep fresh
    res.send(body);
  }),
);

// GET /streaming/media.m3u8?u=&s=&token=  — a variant/media playlist.
streamingRouter.get(
  "/media.m3u8",
  wrap(async (req, res) => {
    const token = String(req.query.token ?? "");
    const u = String(req.query.u ?? "");
    const s = String(req.query.s ?? "");
    if (!verifyPlayback(token)) throw forbidden("Invalid or expired playback token");
    if (!verifyUrlSig(u, s)) throw forbidden("Bad URL signature");
    if (!(await hostAllowed(u))) throw forbidden("Upstream host not allowed");

    const r = await fetch(u);
    if (!r.ok) throw badRequest(`Upstream media ${r.status}`);
    const text = await r.text();
    const body = rewriteManifest(text, u, token, false);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store");
    res.send(body);
  }),
);

// ---- Locally-transcoded HLS (produced by the ffmpeg worker) ----
// Served from storage/hls/<assetId>/, gated by a playback token bound to that
// asset. Manifests are rewritten on the fly to carry the token on child URLs.
streamingRouter.get(
  "/local/:assetId/:file",
  wrap(async (req, res) => {
    const token = String(req.query.token ?? "");
    const payload = verifyPlayback(token);
    if (!payload) throw forbidden("Invalid or expired playback token");
    // Bind the token to this asset so it can't be reused for another title.
    if (payload.assetId !== req.params.assetId) throw forbidden("Token/asset mismatch");

    const file = req.params.file;
    if (!/^[A-Za-z0-9._-]+$/.test(file)) throw forbidden("Bad path"); // no traversal
    const full = path.join(env.storageLocalDir, "hls", req.params.assetId, file);

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(full);
    } catch {
      throw badRequest("Segment not found");
    }

    if (file.endsWith(".m3u8")) {
      // Append the token to every child URI (relative filenames) so segments and
      // sub-playlists stay authorized.
      const text = await fsp.readFile(full, "utf8");
      const body = text
        .split(/\r?\n/)
        .map((line) => {
          if (line.startsWith("#")) {
            return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${uri}?token=${encodeURIComponent(token)}"`);
          }
          if (line.trim() === "" ) return line;
          return `${line.trim()}?token=${encodeURIComponent(token)}`;
        })
        .join("\n");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-store");
      return res.send(body);
    }

    // A media segment on disk: range-served, long cache.
    res.setHeader("Content-Type", contentTypeFor(full));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Accept-Ranges", "bytes");
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (start >= stat.size || end >= stat.size) {
          res.status(416).setHeader("Content-Range", `bytes */${stat.size}`);
          return res.end();
        }
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
        res.setHeader("Content-Length", end - start + 1);
        return fs.createReadStream(full, { start, end }).pipe(res);
      }
    }
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(full).pipe(res);
  }),
);

function contentTypeFor(u: string): string {
  // Accepts a URL or a filesystem path; only the extension matters.
  const p = u.split("?")[0].toLowerCase();
  if (p.endsWith(".ts")) return "video/mp2t";
  if (p.endsWith(".m4s") || p.endsWith(".mp4") || p.endsWith(".m4v")) return "video/mp4";
  if (p.endsWith(".vtt")) return "text/vtt";
  if (p.endsWith(".aac")) return "audio/aac";
  return "application/octet-stream";
}

// Ensure a segment is cached on disk; return its path. Concurrent-safe via tmp+rename.
async function ensureCached(u: string): Promise<string> {
  const key = crypto.createHash("sha256").update(u).digest("hex");
  const file = path.join(env.streamCacheDir, key);
  try {
    await fsp.access(file);
    return file; // cache hit
  } catch {
    /* miss */
  }
  const r = await fetch(u);
  if (!r.ok || !r.body) throw badRequest(`Upstream segment ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, buf);
  await fsp.rename(tmp, file).catch(async () => {
    await fsp.unlink(tmp).catch(() => {});
  });
  return file;
}

// GET /streaming/seg?u=&s=&token=  — a media segment (cached, range-served).
streamingRouter.get(
  "/seg",
  wrap(async (req, res) => {
    const token = String(req.query.token ?? "");
    const u = String(req.query.u ?? "");
    const s = String(req.query.s ?? "");
    if (!verifyPlayback(token)) throw forbidden("Invalid or expired playback token");
    if (!verifyUrlSig(u, s)) throw forbidden("Bad URL signature");
    if (!(await hostAllowed(u))) throw forbidden("Upstream host not allowed");

    const file = await ensureCached(u);
    const stat = await fsp.stat(file);
    const type = contentTypeFor(u);
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Accept-Ranges", "bytes");

    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (start >= stat.size || end >= stat.size) {
          res.status(416).setHeader("Content-Range", `bytes */${stat.size}`);
          return res.end();
        }
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
        res.setHeader("Content-Length", end - start + 1);
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
    }
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(file).pipe(res);
  }),
);
