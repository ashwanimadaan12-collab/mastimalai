import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@masti/types"],
  // Build a self-contained server bundle we can run in Docker.
  output: "standalone",
  // Monorepo: trace files from the repo root so @masti/types is included.
  // (In Next 14 this lives under `experimental`; it became top-level in Next 15.)
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
