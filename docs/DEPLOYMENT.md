# Masti Malai — Deployment Runbook

Recommended topology:

```
  yourdomain.com        -> Web   (Next.js)  on Vercel
  admin.yourdomain.com  -> Admin (Next.js)  on Vercel
  api.yourdomain.com    -> API   (Docker)   on a VM / Render / Railway
                           + PostgreSQL (compose or managed)
```

> ⚠️ **Read "Before real customers" at the bottom first.** Two things are still in
> test posture: OTP delivery (needs an SMS gateway) and payments (sandbox, no real
> money). The app deploys and runs, but don't onboard paying customers until those
> are wired.

---

## 1. API + database (Docker on a VM)

On a Linux VM with Docker installed:

```bash
git clone <your repo> && cd "masti malai"
cp .env.production.example .env.production
# edit .env.production — set POSTGRES_PASSWORD, all *_SECRET values (generate below),
# ADMIN_SEED_*, and the API_PUBLIC_URL / CORS_ORIGIN / ADMIN_CORS_ORIGIN domains.
```

Generate each secret:
```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))'
```

Bring it up (builds the image, starts Postgres + API, pushes the schema):
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Seed the catalog + admin user (once):
```bash
docker compose -f docker-compose.prod.yml exec api npm run seed
docker compose -f docker-compose.prod.yml exec api npm run seed:admin
```

Put **HTTPS + a domain** in front of port 4000 with a reverse proxy (Caddy or
Nginx). Caddy example (`/etc/caddy/Caddyfile`):
```
api.yourdomain.com {
    reverse_proxy localhost:4000
}
```
DNS: point `api.yourdomain.com` A record at the VM's IP.

**Managed Postgres instead of the compose one?** Drop the `db` service and set
`DATABASE_URL` on the `api` service to your managed connection string.

**Media note:** transcoded HLS + cache live in the `media_data` volume. That's fine
for one VM; for scale/CDN, move to S3 later (the storage layer is behind an interface).

---

## 2. Web + Admin (Vercel — easiest)

For each app, create a Vercel project from the same repo:

| | Web | Admin |
| --- | --- | --- |
| Root directory | `apps/web` | `apps/admin` |
| Env `NEXT_PUBLIC_API_BASE_URL` | `https://api.yourdomain.com` | `https://api.yourdomain.com` |
| Domain | `yourdomain.com` | `admin.yourdomain.com` |

Because this is an npm-workspaces monorepo, set the project's **Install Command** to
`npm install` run at the repo root (Vercel's monorepo setting) so `@masti/types`
resolves. Then add your domains in Vercel → Settings → Domains.

(Prefer Docker for these too? Add `output: "standalone"` to each `next.config.mjs`
and build an image — but Vercel is far less fussy for Next.)

---

## 3. Android
Point the app at production and rebuild: in `apps/android/app/build.gradle.kts` set
`API_BASE_URL` to `"https://api.yourdomain.com"`, then build a release APK/AAB in
Android Studio. (Play Store requires Google Play Billing for subscriptions — see the
Android README.)

---

## 4. Operational
- **Backups**: `docker compose ... exec db pg_dump -U masti masti_malai > backup.sql` on a schedule; or use managed-DB automated backups.
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f api`.
- **Update**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`.
- **Admin**: log in at `admin.yourdomain.com` with `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`; change the password immediately.

---

## 5. ⚠️ Before real (paying) customers — required
1. **SMS gateway for OTP.** Keep `OTP_DEV_MODE=false` (already the prod default). Wire
   an SMS provider (MSG91 / Twilio / Gupshup) into `POST /auth/send-otp` + `/auth/continue`
   so returning active subscribers actually receive the OTP. Until then, OTP login for
   returning users won't deliver (new-customer signup + browsing still work). Never set
   `OTP_DEV_MODE=true` on a public deploy — it returns the OTP in the response and allows
   account takeover.
2. **Razorpay for payments.** Replace `PAYMENTS_DRIVER=local-sandbox` with a real Razorpay
   integration (order + checkout + webhook signature verification). Until then no real money
   is collected and the guest checkout grants access on a fake payment.
3. Rotate the seeded admin password; restrict `admin.yourdomain.com` (IP allowlist / SSO if possible).
4. Consider moving web auth tokens from `localStorage` to httpOnly cookies (XSS hardening).
