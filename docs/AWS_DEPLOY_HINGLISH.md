# Masti Malai — AWS Deploy (Single EC2) — Hinglish Runbook

Ye guide **tere setup** ke hisaab se hai:
- Sab kuch **ek hi EC2 server** pe (Postgres + API + Web + Admin + HTTPS).
- Database usi EC2 pe (managed RDS nahi).
- Domain naya lena hai.
- Code abhi zip mein hai — GitHub repo banana hai.

> Is deploy ke baad site live ho jayegi (testing ke liye). **Paying customers se pehle**
> 3 cheezein baaki hain: SMS OTP, Razorpay (web), Google Play Billing (Android). Wo alag
> phase hai — niche "Aage kya" mein likha hai.

---

## Kya-kya naye files add kiye gaye (deploy ke liye)
Ye pehle se nahi the, ab zip mein hain:
- `apps/web/Dockerfile` — web app ko Docker mein chalane ke liye
- `apps/admin/Dockerfile` — admin panel ke liye
- `docker-compose.prod.yml` — **update** hua: ab db + api + web + admin + Caddy sab chalata hai
- `Caddyfile` — automatic free HTTPS (Let's Encrypt)
- `apps/web/next.config.mjs`, `apps/admin/next.config.mjs` — `output: standalone` add kiya
- `.env.production.example` — domain variables add kiye

---

## Step 0 — Domain khareedo
Kisi bhi jagah se le lo (Route 53 / GoDaddy / Namecheap). Maan lo **`mastimalai.com`**.
DNS baad mein 4 records banayenge (Step 5).

## Step 1 — Code GitHub pe daalo
Zip extract karo, phir:
```bash
cd mastimalai
git init
git add .
git commit -m "Masti Malai OTT"
# GitHub pe ek private repo banao, phir:
git remote add origin https://github.com/<tera-username>/mastimalai.git
git branch -M main
git push -u origin main
```
> `.gitignore` pehle se hai — secrets aur node_modules commit nahi honge.

## Step 2 — EC2 server launch karo
AWS Console → EC2 → Launch instance:
- **AMI**: Ubuntu Server 24.04 LTS
- **Type**: `t3.small` (2 GB RAM) se shuru — build ke liye theek. Chhota (`t3.micro`) build mein slow/fail ho sakta hai.
- **Storage**: 30 GB
- **Key pair**: ek banao (`.pem` file save karo, isse SSH karoge)
- **Security group** (firewall) — ye ports open karo:
  - SSH (22) — sirf apne IP se
  - HTTP (80) — anywhere
  - HTTPS (443) — anywhere
- Launch karo. **Elastic IP** allocate karke instance se attach kar do (taaki IP kabhi na badle).

## Step 3 — Server pe Docker install
SSH karo:
```bash
ssh -i tera-key.pem ubuntu@<EC2-Elastic-IP>
```
Phir:
```bash
sudo apt update && sudo apt install -y ca-certificates curl git
# Docker install
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# logout + login (taaki docker bina sudo chale)
exit
```
Wapas SSH karo, test: `docker run hello-world`

## Step 4 — Code + secrets set karo
```bash
git clone https://github.com/<tera-username>/mastimalai.git
cd mastimalai
cp .env.production.example .env.production
```
Ab **har secret generate** karo (4 baar chalao, har output alag secret mein daalo):
```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))'
```
> Node nahi hai server pe? `sudo apt install -y nodejs` ya online generate kar lo.

`nano .env.production` — ye bharo:
- `POSTGRES_PASSWORD` — ek strong password
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, `PLAYBACK_TOKEN_SECRET` — upar wale generated secrets
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — apna admin login
- `OTP_DEV_MODE=false` (aise hi rehne do — public pe kabhi true nahi)
- `PAYMENTS_DRIVER=local-sandbox` (abhi test; Razorpay baad mein)
- Domain lines (apne domain se replace karo):
  ```
  ROOT_DOMAIN=mastimalai.com
  WEB_DOMAIN=www.mastimalai.com
  API_DOMAIN=api.mastimalai.com
  ADMIN_DOMAIN=admin.mastimalai.com
  API_PUBLIC_URL=https://api.mastimalai.com
  CORS_ORIGIN=https://mastimalai.com,https://www.mastimalai.com
  ADMIN_CORS_ORIGIN=https://admin.mastimalai.com
  ```
Save karo (Ctrl+O, Enter, Ctrl+X).

## Step 5 — DNS point karo (HTTPS se pehle zaroori)
Domain ke DNS mein **4 A records** banao, sab EC2 ke **Elastic IP** pe:

| Type | Name | Value |
|---|---|---|
| A | `@` (root) | EC2 Elastic IP |
| A | `www` | EC2 Elastic IP |
| A | `api` | EC2 Elastic IP |
| A | `admin` | EC2 Elastic IP |

> DNS ko fail hone mein 5–30 min lag sakte hain. Aage badhne se pehle
> `ping api.mastimalai.com` se check karo ki IP sahi aa raha hai. Caddy ko
> HTTPS cert tabhi milega jab DNS sahi point kar raha ho.

## Step 6 — Poora stack up karo
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
Pehli baar build mein 5–10 min lagenge (web + admin build hote hain). Phir:
```bash
# demo catalog + admin user seed karo (ek hi baar)
docker compose -f docker-compose.prod.yml exec api npm run seed
docker compose -f docker-compose.prod.yml exec api npm run seed:admin
```
Check karo sab chal raha hai:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy   # HTTPS cert aata dikhega
```

## Step 7 — Test karo
Browser mein khol:
- `https://mastimalai.com` — consumer site
- `https://admin.mastimalai.com` — admin panel (apne `ADMIN_SEED_EMAIL`/password se login, phir password turant badlo)
- `https://api.mastimalai.com/health` — API (agar health route hai)

Login flow: 10-digit number daalo. **Abhi OTP deliver nahi hoga** (SMS gateway nahi lagा) —
ye expected hai jab tak Razorpay/SMS phase nahi karte.

---

## Roz ke kaam (operations)
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f api`
- **Update deploy**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- **DB backup** (roz cron pe rakho):
  ```bash
  docker compose -f docker-compose.prod.yml exec db pg_dump -U masti masti_malai > backup-$(date +%F).sql
  ```
- **Restart**: `docker compose -f docker-compose.prod.yml restart`

---

## Aage kya (paise lene se pehle — CRITICAL)
1. **SMS OTP gateway** — MSG91/Twilio ko `POST /auth/send-otp` + `/auth/continue` mein wire karo.
   Tab tak returning users login nahi kar payenge.
2. **Razorpay (web/Android web-flow ke liye)** — `services/api/src/providers/index.ts` mein
   `LocalSandboxPayments` ko asli Razorpay se replace karo (order + checkout + webhook verify),
   phir `.env.production` mein `PAYMENTS_DRIVER=razorpay`.
3. **Demo content hatao** — admin panel se seeded 10 movies/5 series hata ke apna content daalo.
4. **Admin restrict** — `admin.` subdomain ko IP allowlist ya login-hardening do.
5. **(Baad mein) S3 + CloudFront** — asli video files aur HLS ke liye, jab traffic badhe.

## Scale ke liye (baad mein, abhi zaroori nahi)
- Database ko **RDS** pe le jao (auto-backup) — compose se `db` service hata ke `DATABASE_URL`
  ko RDS endpoint pe set karo.
- Web + Admin ko **AWS Amplify** pe le ja sakte ho (EC2 halka ho jayega).
- EC2 chhota pad raha ho to bada instance ya load balancer.
