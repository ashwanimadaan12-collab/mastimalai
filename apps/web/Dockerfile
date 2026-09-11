# Masti Malai — Web (consumer site) production image.
# Built from the MONOREPO ROOT so the @masti/types workspace resolves.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com -t masti-web .
# (docker-compose.prod.yml does this for you.)

# ---------- build ----------
FROM node:20-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* is baked into the client bundle at build time, so it must be set here.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

# Install the workspace needed for this app (root + packages/types + apps/web).
COPY package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm install

RUN npm run build --workspace @masti/web

# ---------- run ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output bundles a minimal node_modules + server.js.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
