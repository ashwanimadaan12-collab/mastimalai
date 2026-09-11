# Masti Malai OTT — Architecture

> "Entertainment Ka Full Tadka"

## 1. Principle: one backend, many clients

```
  Web (Next.js)     Android (future)     Admin (future)
        \                 |                   /
         \                |                  /
          \---------->  REST API  <---------/
                          |
             ┌────────────┼─────────────┐
        PostgreSQL      Redis?       Storage/Stream
        (Prisma)      (optional)   (local dir in dev;
                                    S3+CDN+HLS in prod)
```

All catalog, users, subscriptions, watch state, homepage layout and settings live in the
backend/database. Clients render what the API returns — nothing about the catalog or a
user's entitlement is hard-coded in a client. This is what lets Web + Android + Admin stay
in sync (continue-watching on Android resumes on Web, etc.).

## 2. What is built in this foundation (Phase 1, backend + web)

| Area | Status |
| --- | --- |
| Monorepo (npm workspaces) | ✅ `packages/`, `services/api`, `apps/web` |
| PostgreSQL schema (Prisma) | ✅ core tables |
| Auth: mobile OTP → JWT access + refresh | ✅ (dev OTP returned in response) |
| Profiles (multi-profile, kids flag) | ✅ |
| Catalog: movies, series, seasons, episodes, genres, languages | ✅ read APIs + CMS-shaped fields |
| Homepage sections (dynamic, DB-driven) | ✅ |
| Search + filters | ✅ basic |
| Watchlist / continue-watching / history | ✅ |
| Subscription plans + entitlement check | ✅ |
| Payments | ⚠️ **local sandbox only** (no real Razorpay) |
| Signed playback tokens | ✅ (HMAC short-lived token; no DRM) |
| Video transcoding pipeline | ✅ ffmpeg HLS ladder (240p–1080p) + upload/sample ingest + local delivery |
| Web UI: home, browse, detail, player, login, my-list, subscription | ✅ |
| Admin panel, Android app, notifications, AI, analytics | ⛔ later phases |

## 3. Deliberate substitutions for local dev

The spec targets S3 + CDN + ffmpeg transcoding + Razorpay + Redis + Docker. This machine has
none of those but has a running local PostgreSQL. Substitutions, each behind an interface so
production wiring is a config swap, not a rewrite:

- **Storage/streaming** → local filesystem (`STORAGE_DRIVER=local`). `StorageService` interface
  has one `local` impl; add an `s3` impl later. A **streaming edge** (`modules/streaming`) reverse-
  proxies + disk-caches HLS so playback is fast without a CDN; in prod a real CDN replaces it and the
  player contract (signed master URL from `/playback/token`) is unchanged.
- **Transcoding** → real **ffmpeg** worker (`modules/streaming/transcode.ts`) building a 240p–1080p HLS
  ladder into local storage, run as an in-process background job (`jobs.ts`). Swap the job for a queue
  (BullMQ/SQS) in prod; the asset lifecycle contract is unchanged.
- **Payments** → `PaymentProvider` interface with a `local-sandbox` impl that simulates order
  create + verify. Real impl is Razorpay with server-side signature verification + webhooks.
- **Cache/OTP store** → Redis if `REDIS_URL` set, else in-memory `Map` (dev only).

## 4. Backend layering (`services/api`)

```
src/
  config/        env loading + validation
  lib/           prisma client, redis-or-memory store, logger
  modules/
    auth/        OTP + JWT, guards
    users/       user + profile
    catalog/     movies, series, episodes, genres, languages
    home/        homepage section assembly
    search/
    watch/       progress, continue, history
    watchlist/
    billing/     plans, subscriptions, entitlement
    playback/    signed token issue + verify, access-control logic
  providers/     storage, transcode, payment (swappable)
  middleware/    error handler, auth, rate limit, validation (zod)
  routes.ts      wires modules to Express router
  server.ts      bootstrap
```

Business logic lives in services, not routes, and never in the client. Playback access runs
the full check chain (auth → profile → availability → subscription → entitlement → token).

## 5. Security posture (foundation)

- Passwordless (mobile OTP); no passwords stored. JWT access (short) + refresh (rotating-capable).
- Playback URLs are never permanent public MP4s — clients request a short-lived HMAC token per play.
- Secrets only in `.env` (git-ignored). `.env.example` documents them.
- Rate limiting on auth + a global limiter; zod validation on inputs; centralized error handler.
- Not yet: full RBAC admin, DRM/Widevine, webhook signature verification (no real gateway yet).

See [ERD.md](./ERD.md), [API.md](./API.md), [ROADMAP.md](./ROADMAP.md).
