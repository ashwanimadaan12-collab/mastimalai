# Masti Malai — Admin panel production image.
# Built from the MONOREPO ROOT so the @masti/types workspace resolves.
#   docker build -f apps/admin/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com -t masti-admin .
# (docker-compose.prod.yml does this for you.)

# ---------- build ----------
FROM node:20-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY package.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN npm install

RUN npm run build --workspace @masti/admin

# ---------- run ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
