import "dotenv/config";

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: (process.env.NODE_ENV ?? "development") !== "production",
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: req("DATABASE_URL"),

  jwtAccessSecret: req("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
  jwtRefreshSecret: req("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",

  adminJwtSecret: req("ADMIN_JWT_SECRET", "dev-admin-secret-change-me"),
  adminJwtTtl: process.env.ADMIN_JWT_TTL ?? "8h",
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL ?? "admin@mastimalai.com",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD ?? "Masti@12345",

  otpDevMode: (process.env.OTP_DEV_MODE ?? "true") === "true",
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),

  redisUrl: process.env.REDIS_URL || "",

  playbackTokenSecret: req("PLAYBACK_TOKEN_SECRET", "dev-playback-secret-change-me"),
  playbackTokenTtlSeconds: Number(process.env.PLAYBACK_TOKEN_TTL_SECONDS ?? 21600),

  storageDriver: process.env.STORAGE_DRIVER ?? "local",
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? "./storage-dev",

  // Streaming edge-cache (dev "CDN origin"). Segments are cached here on disk.
  streamCacheDir: process.env.STREAM_CACHE_DIR ?? "./storage-dev/hls-cache",
  // SSRF allowlist: the proxy will only fetch upstream segments from these hosts.
  // Hosts always allowed for the streaming proxy (in addition to any public host
  // when streamAllowAnyPublic is true).
  streamUpstreamHosts: (
    process.env.STREAM_UPSTREAM_HOSTS ??
    "test-streams.mux.dev,devstreaming-cdn.apple.com,stream.mux.com"
  )
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
  // Allow any PUBLIC host (private/internal IPs still blocked). Admins set arbitrary
  // CDN/HLS URLs, so this is on by default; set false to lock down to the list above.
  streamAllowAnyPublic: (process.env.STREAM_ALLOW_ANY_PUBLIC ?? "true") === "true",
  apiPublicUrl: process.env.API_PUBLIC_URL ?? "http://localhost:4000",

  // Transcoder (ffmpeg). Empty = look up on PATH.
  ffmpegPath: process.env.FFMPEG_PATH ?? "",
  ffprobePath: process.env.FFPROBE_PATH ?? "",
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 2_000_000_000), // 2 GB

  paymentsDriver: process.env.PAYMENTS_DRIVER ?? "local-sandbox",

  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  adminCorsOrigin: process.env.ADMIN_CORS_ORIGIN ?? "http://localhost:3001",

  maxProfilesPerUser: 5,
} as const;
