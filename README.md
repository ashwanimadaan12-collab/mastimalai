# Masti Malai OTT — _Entertainment Ka Full Tadka_

Foundation build: **one backend powering the web app** (Android/Admin come later). Monorepo,
PostgreSQL, OTP auth, dynamic catalog + homepage, watchlist, continue-watching, subscriptions,
and secure signed-token playback.

> This is a Phase-1 foundation, not the full 12-phase platform. See
> [docs/ROADMAP.md](docs/ROADMAP.md) for what's built vs. next, and
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design.

## Stack
- **Backend** (`services/api`): Node + Express + TypeScript, Prisma, PostgreSQL, JWT + OTP.
- **Web** (`apps/web`): Next.js 14 (App Router) + TypeScript + Tailwind, HLS.js player.
- **Shared** (`packages/types`): DTO types used by both.

## Prerequisites
- Node 20+, a running PostgreSQL (this repo was set up against a local Homebrew Postgres 16).
- No Docker/Redis/ffmpeg required — see the substitutions note in the architecture doc.

## Setup
```bash
# 1. install
npm install

# 2. create the DB (once) — adjust user/host if needed
createdb masti_malai

# 3. point services/api/.env DATABASE_URL at your Postgres, then:
npm run db:generate
npm run db:push
npm run seed        # loads 10 movies, 5 series, plans, banners (DEMO DATA)
```
Set `apps/web/.env.local` → `NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"`.

Seed the admin users (once): `npm run seed:admin`.

## Run (three terminals)
```bash
npm run dev:api     # http://localhost:4000
```
```bash
npm run dev:web     # http://localhost:3000  (consumer site)
```
```bash
npm run dev --workspace @masti/admin   # http://localhost:3001  (admin panel)
```

### Admin panel
Open http://localhost:3001 and sign in:
- **Super admin**: `admin@mastimalai.com` / `Masti@12345` (full access)
- **Content admin**: `content@mastimalai.com` / `Content@12345` (content + homepage only — RBAC demo)

Create/edit movies & series, manage the homepage layout, plans, users, subscriptions, and see the
audit log. Anything you publish appears on the consumer site immediately (same backend).

## Try it
1. Open http://localhost:3000 — browse the seeded home page.
2. **Login** → enter any valid-format mobile (e.g. `9876543210`). Dev mode shows the OTP on
   screen and auto-fills it.
3. Open a **premium** title and hit Play → you'll see the subscription wall.
4. **Subscribe** (local sandbox — no real money) → premium unlocks.
5. Play, seek, leave, come back → **Continue Watching** resumes your position.

## Android app
Native Kotlin + Compose + Media3 app on the same backend lives in
[`apps/android`](apps/android/README.md). Open that folder in **Android Studio** (it brings its
own JDK/SDK/emulator), start the backend, and Run ▶ — the emulator reaches the API at
`http://10.0.2.2:4000` by default. Full setup in its README.

## What's intentionally stubbed (documented)
- **Payments**: local sandbox only, never contacts Razorpay. Server-side verify + idempotency
  are real; the gateway is swapped behind a `PaymentProvider` interface.
- **Transcoding**: no ffmpeg on host → seeded titles use public HLS test streams. Pipeline is a
  `TranscodeProvider` stub ready for a real worker.
- **Auth tokens on web**: stored in localStorage (dev-grade). Production → httpOnly cookies.

See [docs/API.md](docs/API.md) for the full endpoint list.
