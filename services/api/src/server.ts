import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { api } from "./routes.js";
import { errorHandler, globalLimiter } from "./middleware/index.js";

const app = express();

const allowedOrigins = [
  ...env.corsOrigin.split(","),
  ...env.adminCorsOrigin.split(","),
].map((o) => o.trim());
app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// Basic secure headers (a helmet dependency would formalize this later).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(globalLimiter);
app.use(api);
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[masti-api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
