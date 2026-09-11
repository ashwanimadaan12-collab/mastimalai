import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound, wrap } from "../../lib/http.js";
import { requireAuth, requireProfile } from "../../middleware/index.js";
import { movieSummary, episodeSummary } from "../catalog/serialize.js";
import { buildContinueWatching } from "./continue.js";

export const watchRouter = Router();
watchRouter.use(requireAuth, requireProfile);

// POST /watch/progress — upsert playback position (drives resume + history).
watchRouter.post(
  "/progress",
  wrap(async (req, res) => {
    const body = z
      .object({
        movieId: z.string().optional(),
        episodeId: z.string().optional(),
        positionSec: z.number().int().min(0),
        durationSec: z.number().int().min(0),
      })
      .refine((b) => !!b.movieId !== !!b.episodeId, {
        message: "Provide exactly one of movieId or episodeId",
      })
      .parse(req.body);

    const completed =
      body.durationSec > 0 && body.positionSec / body.durationSec >= 0.95;

    const where = body.movieId
      ? { profileId_movieId: { profileId: req.profileId!, movieId: body.movieId } }
      : { profileId_episodeId: { profileId: req.profileId!, episodeId: body.episodeId! } };

    const data = {
      profileId: req.profileId!,
      movieId: body.movieId ?? null,
      episodeId: body.episodeId ?? null,
      positionSec: body.positionSec,
      durationSec: body.durationSec,
      completed,
    };

    const saved = await prisma.watchProgress.upsert({
      where: where as any,
      create: data,
      update: {
        positionSec: body.positionSec,
        durationSec: body.durationSec,
        completed,
      },
    });
    res.json(saved);
  }),
);

// GET /watch/continue
watchRouter.get(
  "/continue",
  wrap(async (req, res) => {
    res.json({ items: await buildContinueWatching(req.profileId!) });
  }),
);

// GET /watch/history
watchRouter.get(
  "/history",
  wrap(async (req, res) => {
    const rows = await prisma.watchProgress.findMany({
      where: { profileId: req.profileId! },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    const items: any[] = [];
    for (const p of rows) {
      if (p.movieId) {
        const m = await prisma.movie.findUnique({ where: { id: p.movieId } });
        if (m) items.push({ ...p, content: { ...movieSummary(m), resumeKind: "movie" } });
      } else if (p.episodeId) {
        const e = await prisma.episode.findUnique({
          where: { id: p.episodeId },
          include: { videoAsset: true, season: { include: { series: true } } },
        });
        if (e)
          items.push({
            ...p,
            content: {
              ...episodeSummary(e),
              resumeKind: "episode",
              seriesSlug: e.season.series.slug,
              seriesTitle: e.season.series.title,
            },
          });
      }
    }
    res.json({ items });
  }),
);

// DELETE /watch/history/:id  and  DELETE /watch/history (clear all)
watchRouter.delete(
  "/history/:id",
  wrap(async (req, res) => {
    const existing = await prisma.watchProgress.findFirst({
      where: { id: req.params.id, profileId: req.profileId! },
    });
    if (!existing) throw notFound("History item not found");
    await prisma.watchProgress.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
watchRouter.delete(
  "/history",
  wrap(async (req, res) => {
    await prisma.watchProgress.deleteMany({ where: { profileId: req.profileId! } });
    res.json({ ok: true });
  }),
);
