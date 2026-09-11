import { prisma } from "../../lib/prisma.js";
import { movieSummary, episodeSummary } from "../catalog/serialize.js";

// Assemble the Continue-Watching list for a profile: unfinished items,
// most recently watched first, resolved to full content cards.
export async function buildContinueWatching(profileId: string, take = 20) {
  const rows = await prisma.watchProgress.findMany({
    where: { profileId, completed: false, positionSec: { gt: 5 } },
    orderBy: { updatedAt: "desc" },
    take,
  });

  const out: any[] = [];
  for (const p of rows) {
    if (p.movieId) {
      const m = await prisma.movie.findUnique({ where: { id: p.movieId } });
      if (!m || m.status !== "PUBLISHED") continue;
      out.push({
        id: p.id,
        positionSec: p.positionSec,
        durationSec: p.durationSec,
        updatedAt: p.updatedAt,
        content: { ...movieSummary(m), resumeKind: "movie" },
      });
    } else if (p.episodeId) {
      const e = await prisma.episode.findUnique({
        where: { id: p.episodeId },
        include: { videoAsset: true, season: { include: { series: true } } },
      });
      if (!e || e.season.series.status !== "PUBLISHED") continue;
      out.push({
        id: p.id,
        positionSec: p.positionSec,
        durationSec: p.durationSec,
        updatedAt: p.updatedAt,
        content: {
          ...episodeSummary(e),
          resumeKind: "episode",
          seriesSlug: e.season.series.slug,
          seriesTitle: e.season.series.title,
        },
      });
    }
  }
  return out;
}
