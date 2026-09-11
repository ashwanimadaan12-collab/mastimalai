import { Router } from "express";
import { authRouter } from "./modules/auth/auth.router.js";
import { usersRouter, profilesRouter } from "./modules/users/users.router.js";
import { catalogRouter } from "./modules/catalog/catalog.router.js";
import { homeRouter } from "./modules/home/home.router.js";
import { watchRouter } from "./modules/watch/watch.router.js";
import { watchlistRouter } from "./modules/watchlist/watchlist.router.js";
import {
  plansRouter,
  subscriptionsRouter,
  paymentsRouter,
  guestRouter,
} from "./modules/billing/billing.router.js";
import { playbackRouter } from "./modules/playback/playback.router.js";
import { streamingRouter } from "./modules/streaming/streaming.router.js";
import { adminRouter } from "./modules/admin/index.js";

export const api = Router();

api.get("/health", (_req, res) => res.json({ ok: true, service: "masti-api" }));

api.use("/auth", authRouter);
api.use("/users", usersRouter);
api.use("/profiles", profilesRouter);
api.use("/", catalogRouter); // /movies, /series, /genres, /languages, /search
api.use("/home", homeRouter);
api.use("/watch", watchRouter);
api.use("/watchlist", watchlistRouter);
api.use("/plans", plansRouter);
api.use("/subscriptions", subscriptionsRouter);
api.use("/payments", guestRouter); // public guest checkout (/payments/guest/*)
api.use("/payments", paymentsRouter); // authed (/payments/create-order, /verify)
api.use("/playback", playbackRouter);
api.use("/streaming", streamingRouter);
api.use("/admin", adminRouter);
