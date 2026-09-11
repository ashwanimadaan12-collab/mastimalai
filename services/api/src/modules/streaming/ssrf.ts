// SSRF guard shared by the streaming proxy and the transcode-from-URL endpoint.
// Blocks loopback / private / link-local / reserved targets; allows public hosts
// (plus an explicit env allowlist). Domains are DNS-resolved and every address checked.
import dns from "node:dns/promises";
import net from "node:net";
import { env } from "../../config/env.js";

export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // unrecognised → unsafe
}

export async function safeUpstreamUrl(u: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (env.streamUpstreamHosts.includes(url.hostname)) return true;
  if (!env.streamAllowAnyPublic) return false;
  if (net.isIP(url.hostname)) return !isPrivateIp(url.hostname);
  try {
    const records = await dns.lookup(url.hostname, { all: true });
    return records.length > 0 && records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}
