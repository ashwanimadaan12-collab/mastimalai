import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound, wrap } from "../../lib/http.js";
import { requireAuth, requireProfile } from "../../middleware/index.js";
import { movieSummary, seriesSummary } from "../catalog/serialize.js";

export const watchlistRouter = Router();
watchlistRouter.use(requireAuth, requireProfile);

// GET /watchlist?sort=recent|az
watchlistRouter.get(
  "/",
  wrap(async (req, res) => {
    const sort = req.query.sort === "az" ? "az" : "recent";
    const rows = await prisma.watchlistItem.findMany({
      where: { profileId: req.profileId! },
      orderBy: { createdAt: "desc" },
    });
    const movieIds = rows.filter((r) => r.movieId).map((r) => r.movieId!) as string[];
    const seriesIds = rows.filter((r) => r.seriesId).map((r) => r.seriesId!) as string[];
    const [movies, series] = await Promise.all([
      movieIds.length ? prisma.movie.findMany({ where: { id: { in: movieIds } } }) : [],
      seriesIds.length ? prisma.series.findMany({ where: { id: { in: seriesIds } } }) : [],
    ]);
    const mMap = new Map(movies.map((m) => [m.id, m]));
    const sMap = new Map(series.map((s) => [s.id, s]));
    let items = rows
      .map((r) => {
        const card = r.movieId
          ? mMap.get(r.movieId) && movieSummary(mMap.get(r.movieId))
          : r.seriesId && sMap.get(r.seriesId) && seriesSummary(sMap.get(r.seriesId));
        return card ? { id: r.id, content: card } : null;
      })
      .filter(Boolean) as { id: string; content: any }[];
    if (sort === "az")
      items = items.sort((a, b) => a.content.title.localeCompare(b.content.title));
    res.json({ items });
  }),
);

// POST /watchlist
watchlistRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = z
      .object({ movieId: z.string().optional(), seriesId: z.string().optional() })
      .refine((b) => !!b.movieId !== !!b.seriesId, {
        message: "Provide exactly one of movieId or seriesId",
      })
      .parse(req.body);
    const item = await prisma.watchlistItem.upsert({
      where: body.movieId
        ? { profileId_movieId: { profileId: req.profileId!, movieId: body.movieId } }
        : { profileId_seriesId: { profileId: req.profileId!, seriesId: body.seriesId! } },
      create: { profileId: req.profileId!, ...body },
      update: {},
    });
    res.status(201).json(item);
  }),
);

// DELETE /watchlist/:id
watchlistRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const existing = await prisma.watchlistItem.findFirst({
      where: { id: req.params.id, profileId: req.profileId! },
    });
    if (!existing) throw notFound("Watchlist item not found");
    await prisma.watchlistItem.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
