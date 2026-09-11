// Server-safe API helpers for public catalog data (used by server components
// so detail pages can be SSR'd with SEO metadata).
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Every request from the web client is tagged so the backend can filter content
// and plans to web-enabled ones only.
export const PLATFORM_HEADERS = { "X-Platform": "web" } as const;

export async function apiGet<T>(
  path: string,
  opts?: { revalidate?: number },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Platform": "web" },
    next: { revalidate: opts?.revalidate ?? 60 },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiGetSafe<T>(
  path: string,
  fallback: T,
  opts?: { revalidate?: number },
): Promise<T> {
  try {
    return await apiGet<T>(path, opts);
  } catch {
    return fallback;
  }
}

export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function fmtDuration(sec?: number | null): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
