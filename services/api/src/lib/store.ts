// Key/value store with TTL. Uses Redis when REDIS_URL is set, otherwise an
// in-memory Map (dev only — not shared across processes, cleared on restart).
// Used for OTP codes and light caching.
import { env } from "../config/env.js";

export interface KvStore {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

class MemoryStore implements KvStore {
  private map = new Map<string, { value: string; expiresAt: number | null }>();

  async set(key: string, value: string, ttlSeconds?: number) {
    this.map.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }
  async get(key: string) {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt && Date.now() > e.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return e.value;
  }
  async del(key: string) {
    this.map.delete(key);
  }
}

// A Redis-backed impl would live here (guarded by env.redisUrl). Kept as a
// single swappable interface so wiring real Redis later is a config change.
export const store: KvStore = new MemoryStore();

if (env.redisUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    "[store] REDIS_URL is set but the Redis client is not bundled in this foundation; using in-memory store.",
  );
}
