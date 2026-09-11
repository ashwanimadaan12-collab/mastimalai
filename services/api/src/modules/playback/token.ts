// Shared playback-security helpers: short-lived HMAC playback tokens (issued per
// play, run through the access-control chain) and per-URL signatures used by the
// streaming proxy to prevent it becoming an open relay (SSRF).
import crypto from "node:crypto";
import { env } from "../../config/env.js";

export interface PlaybackTokenPayload {
  sub: string; // userId
  assetId: string;
  streamUrl: string; // upstream master manifest URL
  exp: number; // unix seconds
}

export function signPlayback(p: PlaybackTokenPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", env.playbackTokenSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPlayback(token: string): PlaybackTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac("sha256", env.playbackTokenSecret)
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as PlaybackTokenPayload;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}

// Sign an arbitrary upstream URL so the streaming proxy will only fetch URLs it
// itself minted (segments/sub-manifests it rewrote), never attacker-supplied ones.
export function signUrl(u: string): string {
  return crypto.createHmac("sha256", env.playbackTokenSecret).update(u).digest("base64url");
}
export function verifyUrlSig(u: string, sig: string): boolean {
  const expected = signUrl(u);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
