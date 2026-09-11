import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import {
  badRequest,
  forbidden,
  notFound,
  paymentRequired,
  wrap,
} from "../../lib/http.js";
import { requireAuth, requireProfile } from "../../middleware/index.js";
import { getEntitlement } from "../billing/entitlement.js";
import { signPlayback, verifyPlayback } from "./token.js";
import { allowedOnPlatform } from "../../lib/platform.js";

export const playbackRouter = Router();

// POST /playback/token — the full access-control chain (§74), then issues a
// signed short-lived token and a playback URL that goes through the streaming
// edge (fast, cached) rather than exposing the upstream URL.
playbackRouter.post(
  "/token",
  requireAuth,
  requireProfile,
  wrap(async (req, res) => {
    const body = z
      .object({ movieId: z.string().optional(), episodeId: z.string().optional() })
      .refine((b) => !!b.movieId !== !!b.episodeId, {
        message: "Provide exactly one of movieId or episodeId",
      })
      .parse(req.body);

    let access: "FREE" | "PREMIUM";
    let assetId: string | null = null;
    let streamUrl: string | null = null;
    let ageRating: string | null = null;

    if (body.movieId) {
      const m = await prisma.movie.findFirst({
        where: { id: body.movieId, status: "PUBLISHED" },
        include: { videoAsset: true },
      });
      if (!m) throw notFound("Movie not available");
      if (!allowedOnPlatform(req, m.platforms)) throw notFound("Not available on this platform");
      access = m.access;
      ageRating = m.ageRating;
      assetId = m.videoAsset?.id ?? null;
      streamUrl = m.videoAsset?.status === "READY" ? m.videoAsset.streamUrl ?? null : null;
    } else {
      const e = await prisma.episode.findFirst({
        where: { id: body.episodeId!, status: "PUBLISHED" },
        include: { videoAsset: true, season: { include: { series: true } } },
      });
      if (!e || e.season.series.status !== "PUBLISHED")
        throw notFound("Episode not available");
      if (!allowedOnPlatform(req, e.season.series.platforms))
        throw notFound("Not available on this platform");
      access = e.access;
      assetId = e.videoAsset?.id ?? null;
      streamUrl = e.videoAsset?.status === "READY" ? e.videoAsset.streamUrl ?? null : null;
    }

    if (!assetId || !streamUrl)
      throw badRequest("This title is not ready to stream yet");

    const profile = await prisma.profile.findUnique({ where: { id: req.profileId! } });
    if (profile?.isKids && (ageRating === "A" || ageRating === "18+")) {
      throw forbidden("Not available on a kids profile");
    }

    if (access === "PREMIUM") {
      const ent = await getEntitlement(req.userId!);
      if (!ent.isActive) throw paymentRequired("Masti Premium required to watch this");
    }

    const progress = await prisma.watchProgress.findFirst({
      where: body.movieId
        ? { profileId: req.profileId!, movieId: body.movieId }
        : { profileId: req.profileId!, episodeId: body.episodeId! },
    });

    const exp = Math.floor(Date.now() / 1000) + env.playbackTokenTtlSeconds;
    const token = signPlayback({ sub: req.userId!, assetId, streamUrl, exp });

    // Deliver through the streaming edge as a RELATIVE path — the client joins it
    // with its own API base, so it works from web, emulator, device or a domain.
    // Locally-transcoded HLS is served directly (token appended); a remote HLS
    // upstream is reverse-proxied + cached; a non-HLS direct URL is passed as-is.
    const isLocalHls = streamUrl.includes("/streaming/local/");
    const isRemoteHls = !isLocalHls && /\.m3u8(\?|$)/i.test(streamUrl);
    const playbackUrl = isLocalHls
      ? `/streaming/local/${assetId}/master.m3u8?token=${encodeURIComponent(token)}`
      : isRemoteHls
        ? `/streaming/master.m3u8?token=${encodeURIComponent(token)}`
        : streamUrl;

    res.json({
      streamUrl: playbackUrl,
      token,
      expiresInSec: env.playbackTokenTtlSeconds,
      startPositionSec: progress?.positionSec ?? 0,
    });
  }),
);

// GET /playback/stream?token= — legacy/direct entry; redirects to the edge master.
playbackRouter.get(
  "/stream",
  wrap(async (req, res) => {
    const token = String(req.query.token ?? "");
    const payload = verifyPlayback(token);
    if (!payload) throw forbidden("Invalid or expired playback token");
    const isHls = /\.m3u8(\?|$)/i.test(payload.streamUrl);
    res.redirect(
      302,
      isHls
        ? `${env.apiPublicUrl}/streaming/master.m3u8?token=${encodeURIComponent(token)}`
        : payload.streamUrl,
    );
  }),
);
