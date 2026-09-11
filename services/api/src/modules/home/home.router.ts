import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { wrap } from "../../lib/http.js";
import { verifyAccessToken } from "../auth/tokens.js";
import { movieSummary, seriesSummary } from "../catalog/serialize.js";
import { buildContinueWatching } from "../watch/continue.js";
import { platformWhere } from "../../lib/platform.js";

export const homeRouter = Router();

// Soft auth: resolve a valid profile if provided, else render the public home.
async function resolveProfile(req: import("express").Request): Promise<string | null> {
  const header = req.header("authorization");
  const profileId = req.header("x-profile-id");
  if (!header?.startsWith("Bearer ") || !profileId) return null;
  try {
    const { sub } = verifyAccessToken(header.slice(7));
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: sub },
      select: { id: true },
    });
    return profile?.id ?? null;
  } catch {
    return null;
  }
}

// GET /home — fully DB-driven sections (hero, carousels, top10, continue watching).
homeRouter.get(
  "/",
  wrap(async (req, res) => {
    const profileId = await resolveProfile(req);
    const sections = await prisma.homeSection.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        heroItems: { where: { isActive: true }, orderBy: { order: "asc" } },
        items: { orderBy: { order: "asc" } },
      },
    });

    const out = [];
    for (const s of sections) {
      if (s.type === "HERO") {
        out.push({
          id: s.id,
          title: s.title,
          type: "HERO",
          items: [],
          hero: s.heroItems.map((h) => ({
            id: h.id,
            title: h.title,
            subtitle: h.subtitle,
            description: h.description,
            backdrop: h.backdrop,
            poster: h.poster,
            trailerUrl: h.trailerUrl,
            ctaLabel: h.ctaLabel,
            target:
              h.targetKind && h.targetSlug
                ? { kind: h.targetKind as "movie" | "series", slug: h.targetSlug }
                : null,
          })),
        });
        continue;
      }

      if (s.type === "CONTINUE_WATCHING") {
        if (!profileId) continue; // hide when no active profile
        const items = await buildContinueWatching(profileId);
        if (items.length === 0) continue;
        out.push({ id: s.id, title: s.title, type: "CONTINUE_WATCHING", items, continueWatching: items });
        continue;
      }

      // CAROUSEL / TOP10 — resolve referenced content in order.
      const movieIds = s.items.filter((i) => i.movieId).map((i) => i.movieId!) as string[];
      const seriesIds = s.items.filter((i) => i.seriesId).map((i) => i.seriesId!) as string[];
      const platform = platformWhere(req);
      const [movies, series] = await Promise.all([
        movieIds.length
          ? prisma.movie.findMany({ where: { id: { in: movieIds }, status: "PUBLISHED", ...platform } })
          : Promise.resolve([]),
        seriesIds.length
          ? prisma.series.findMany({ where: { id: { in: seriesIds }, status: "PUBLISHED", ...platform } })
          : Promise.resolve([]),
      ]);
      const movieMap = new Map(movies.map((m) => [m.id, m]));
      const seriesMap = new Map(series.map((x) => [x.id, x]));
      const cards = s.items
        .map((i) =>
          i.movieId
            ? movieMap.has(i.movieId)
              ? movieSummary(movieMap.get(i.movieId))
              : null
            : i.seriesId && seriesMap.has(i.seriesId)
              ? seriesSummary(seriesMap.get(i.seriesId))
              : null,
        )
        .filter(Boolean);
      if (cards.length === 0) continue;
      out.push({ id: s.id, title: s.title, type: s.type, items: cards });
    }

    res.json({ sections: out });
  }),
);
