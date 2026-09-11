# Masti Malai API — production image.
# Runs the TypeScript API via tsx (no build step) and includes ffmpeg for the
# transcode worker. Prisma client is generated at build; schema is pushed at start.
FROM node:20-slim

# openssl -> Prisma; ffmpeg -> transcoder; ca-certificates -> https upstreams.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps for the workspace (root + packages/types + services/api).
COPY package.json ./
COPY packages ./packages
COPY services/api ./services/api
RUN npm install

# Generate the Prisma client.
RUN npm run prisma:generate --workspace @masti/api

ENV NODE_ENV=production
ENV API_PORT=4000
EXPOSE 4000

WORKDIR /app/services/api
# Sync schema to the database, then start. (Swap `db push` for `prisma migrate
# deploy` once you adopt migrations.)
CMD ["sh", "-c", "npx prisma db push --skip-generate && node --import tsx src/server.ts"]
