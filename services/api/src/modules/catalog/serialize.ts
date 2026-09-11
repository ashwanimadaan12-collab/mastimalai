// Prisma record -> API DTO. Keeps wire shape stable and independent of schema.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  MovieSummary,
  MovieDetail,
  SeriesSummary,
  SeriesDetail,
  EpisodeSummary,
  Genre,
  Language,
  CastMember,
} from "@masti/types";

export const movieInclude = {
  language: true,
  genres: true,
  videoAsset: true,
  cast: { orderBy: { order: "asc" } },
} as const;

export const seriesInclude = {
  language: true,
  genres: true,
  cast: { orderBy: { order: "asc" } },
  seasons: {
    orderBy: { number: "asc" },
    include: { episodes: { orderBy: { number: "asc" }, include: { videoAsset: true } } },
  },
} as const;

const genre = (g: any): Genre => ({ id: g.id, name: g.name, slug: g.slug });
const language = (l: any): Language | null =>
  l ? { id: l.id, name: l.name, code: l.code } : null;
const cast = (c: any): CastMember => ({
  id: c.id,
  name: c.name,
  character: c.character,
  role: c.role,
  order: c.order,
});

export function movieSummary(m: any): MovieSummary {
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    poster: m.poster,
    backdrop: m.backdrop,
    year: m.year,
    durationSec: m.durationSec,
    ageRating: m.ageRating,
    access: m.access,
    kind: "movie",
  };
}

export function movieDetail(m: any, related: any[] = []): MovieDetail {
  return {
    ...movieSummary(m),
    description: m.description,
    trailerUrl: m.trailerUrl,
    rating: m.rating,
    genres: (m.genres ?? []).map(genre),
    language: language(m.language),
    cast: (m.cast ?? []).map(cast),
    related: related.map(movieSummary),
    hasVideo: !!(m.videoAsset && m.videoAsset.status === "READY" && m.videoAsset.streamUrl),
  };
}

export function seriesSummary(s: any): SeriesSummary {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    poster: s.poster,
    backdrop: s.backdrop,
    year: s.year,
    access: s.access,
    kind: "series",
  };
}

export function episodeSummary(
  e: any,
  progress?: { positionSec: number; durationSec: number } | null,
): EpisodeSummary {
  return {
    id: e.id,
    title: e.title,
    number: e.number,
    description: e.description,
    thumbnail: e.thumbnail,
    durationSec: e.durationSec,
    access: e.access,
    hasVideo: !!(e.videoAsset && e.videoAsset.status === "READY" && e.videoAsset.streamUrl),
    progress: progress ?? null,
  };
}

export function seriesDetail(
  s: any,
  progressByEpisode: Map<string, { positionSec: number; durationSec: number }> = new Map(),
): SeriesDetail {
  return {
    ...seriesSummary(s),
    description: s.description,
    trailerUrl: s.trailerUrl,
    genres: (s.genres ?? []).map(genre),
    language: language(s.language),
    cast: (s.cast ?? []).map(cast),
    seasons: (s.seasons ?? []).map((se: any) => ({
      id: se.id,
      number: se.number,
      title: se.title,
      episodes: (se.episodes ?? []).map((e: any) =>
        episodeSummary(e, progressByEpisode.get(e.id) ?? null),
      ),
    })),
  };
}
