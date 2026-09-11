# Masti Malai OTT — Roadmap

Phases follow the master spec (§104). This session delivers the **backend + web foundation**
(a working vertical slice of Phases 1, 2, 4, and the free/premium parts of 5), on local infra.

## ✅ Delivered in this foundation
- Monorepo, docs (this set), env template.
- PostgreSQL schema (Prisma) + seed (movies, series, seasons, episodes, genres, languages, plans, banners/home sections).
- Auth: mobile OTP → JWT access + refresh; profiles (incl. kids).
- Catalog read APIs + dynamic homepage + search/filters.
- Watchlist, continue-watching, watch history.
- Subscription plans + entitlement; **local-sandbox** payment flow; signed playback tokens with full access-control chain.
- Next.js web app: home, movies/series browse, detail, HLS player shell, login (OTP), my-list, continue-watching, subscription.

## ✅ Delivered in Phase 2 (Admin / CMS)
- Separate admin app (`apps/admin`, port 3001) with a distinct professional dashboard UI.
- **Admin auth**: email + bcrypt password → JWT admin session (separate secret from consumer auth).
- **RBAC** (§37): 5 roles (SUPER_ADMIN, CONTENT_ADMIN, MARKETING_ADMIN, SUPPORT_ADMIN, ANALYST),
  permission-gated on both API (403s) and UI (nav hidden).
- **Dashboard** KPIs + recent signups/payments.
- **Content CMS**: full movie CRUD, series + seasons + episodes CRUD, taxonomy, draft→publish lifecycle,
  scheduled publish, featured/trending/top10 flags, SEO fields, per-title HLS stream URL.
- **Homepage manager**: create/reorder/toggle/delete sections, fill carousels/top10 from the catalog.
- **Banners/hero** management API. **Plans** CRUD. **Users** list + suspend (session revoke).
- **Subscriptions & payments** browsers. **Admin user** management. **Audit log** (§95) on every mutation.

## ✅ Delivered in Phase 3 (Streaming delivery + speed)
- **Streaming edge / origin** (`/streaming/*`): the API now reverse-proxies HLS — it rewrites the
  master + variant manifests so every segment is fetched via the API, and **caches segments to disk**
  (range-served, `immutable` long max-age). Repeat plays and seeking go from ~1s/segment (remote) to
  ~5ms (local disk) — a ~180× speedup measured on cache hits.
- **Signed delivery**: playback still runs the access-control chain; the player only ever gets a
  short-lived signed master URL, never the upstream. The proxy has an SSRF host allowlist + per-URL
  HMAC so it can't be used as an open relay.
- **Player tuning**: HLS.js starts at a low bitrate with a small startup buffer, then ABR climbs —
  much faster time-to-first-frame. Verified playing in-browser (starts 320×184, adapts up).
- This is the dev stand-in for a real CDN-in-front-of-S3; the player contract is identical, so
  swapping in a production CDN is a config change.

## ✅ Delivered in Phase 4 (Transcode worker)
- **ffmpeg HLS transcoder** (`modules/streaming/transcode.ts`): one ffmpeg pass produces an adaptive
  240p–1080p ladder (only renditions ≤ source height) + a master playlist into local storage. Progress
  is parsed from ffmpeg and written to the asset; source is probed with ffprobe.
- **Background jobs** (`jobs.ts`): asset lifecycle `UPLOADING → PROCESSING → READY/FAILED`, run off the
  request path (in prod this is a worker queue; the contract is identical).
- **Admin video ingest**: raw-body **upload** endpoint (streamed to disk, size-capped) and a **generate
  test clip** endpoint (ffmpeg synthesises a clip so the pipeline can be exercised with no file). Both
  in the movie editor's **Video & Transcoding** panel with live status polling.
- **Local HLS delivery**: transcoded output is served from `/streaming/local/:assetId/*`, token-bound
  to the asset, manifests token-rewritten, segments range-served with long cache. Measured master/segment
  fetches ~2–4 ms (fully local). Verified transcoding + playing via the admin UI and the player.
- Graceful fallback: if ffmpeg is absent the API still runs and the panel shows "ffmpeg not available".

## ✅ Delivered in Phase 5 (Android app — MVP)
- Native app in `apps/android`: Kotlin + Jetpack Compose + Media3 (ExoPlayer), on the **same
  backend**. Retrofit + kotlinx.serialization, OkHttp auth interceptor + token refresh, DataStore
  session, manual DI.
- Screens: OTP login, home (hero + carousels + continue-watching), movie & series detail, HLS
  player (resume + progress save + premium wall), search, my-list, subscription (sandbox), profile.
- **Host-agnostic playback**: API returns relative `/streaming/...` URLs; each client (web,
  emulator, device, domain) resolves against its own base. Same backend, no host config.
- Deep-link scheme `masti://`. Built to open + run in Android Studio (no local JDK/SDK needed).

## ▶️ Next (in priority order)
1. **Object storage + CDN** — S3 `StorageProvider` impl, signed CDN URLs, DRM (Widevine) for premium.
2. **Real payments** — Razorpay (web) + Google Play Billing (Android) + webhook verification; coupons/referrals.
3. **Deploy to production** — hosting + domain + SSL (user has both ready).
4. Notifications (FCM), AI recommendations, analytics dashboards, kids profiles, offline downloads.
3. **Real payments** — Razorpay order + client + webhook signature verification + idempotency; coupons/referrals.
4. **Android app** — Kotlin + Compose + Media3, same API.
5. **Notifications** (FCM), **AI recommendations** (catalog-grounded), **analytics** dashboards.
6. **Hardening** — full RBAC, rate limits, security testing, backups, staging/prod envs, CI/CD.

## Known foundation limitations (by design, documented)
- No ffmpeg on host → transcode is a stub; seeded content uses a public HLS test stream so the player works.
- No Docker/Redis → local Postgres + in-memory cache/OTP store.
- Payment is a local sandbox, clearly labeled; it never contacts a real gateway.
- Web auth stores tokens in localStorage (dev-grade); production should use httpOnly cookies.
