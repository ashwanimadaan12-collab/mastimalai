// Platform targeting. Each client sends an `X-Platform` header (web / android);
// public catalog + plans + playback are filtered so content and plans only appear
// on the platforms the CMS selected. Absent/unknown header => no filter (e.g. curl,
// server-to-server), and admin routes are never filtered.
import type { Request } from "express";

export type Platform = "WEB" | "ANDROID";

export function readPlatform(req: Request): Platform | null {
  const h = (req.header("x-platform") || "").toUpperCase();
  return h === "WEB" || h === "ANDROID" ? (h as Platform) : null;
}

// A Prisma `where` fragment: `{ platforms: { has: "WEB" } }` or `{}`.
export function platformWhere(req: Request): { platforms?: { has: Platform } } {
  const p = readPlatform(req);
  return p ? { platforms: { has: p } } : {};
}

// True when content/plan is visible on the requesting platform (or no platform given).
export function allowedOnPlatform(req: Request, platforms: string[]): boolean {
  const p = readPlatform(req);
  return p === null || platforms.includes(p);
}
