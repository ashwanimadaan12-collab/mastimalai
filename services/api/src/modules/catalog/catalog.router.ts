import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { notFound, wrap } from "../../lib/http.js";
import { platformWhere } from "../../lib/platform.js";
import {
  movieDetail,
  movieInclude,
  movieSummary,
  seriesDetail,
  seriesInclude,
  seriesSummary,
} from "./serialize.js";

export const catalogRouter = Router();

// Only content that is actually live to the public.
const publishedMovie: Prisma.MovieWhereInput = {
  status: "PUBLISHED",
  OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
};
const publishedSeries: Prisma.SeriesWhereInput = {
  status: "PUBLISHED",
  OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
};

const listQuery = z.object({
  genre: z.string().optional(),
  language: z.string().optional(),
  year: z.coerce.number().int().optional(),
  access: z.enum(["FREE", "PREMIUM"]).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

// GET /genres  &  GET /languages
catalogRouter.get(
  "/genres",
  wrap(async (_req, res) => {
    res.json({ items: await prisma.genre.findMany({ orderBy: { name: "asc" } }) });
  }),
);
catalogRouter.get(
  "/languages",
  wrap(async (_req, res) => {
    res.json({ items: await prisma.language.findMany({ orderBy: { name: "asc" } }) });
  }),
);

// GET /movies
catalogRouter.get(
  "/movies",
  wrap(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where: Prisma.MovieWhereInput = {
      ...publishedMovie,
      ...platformWhere(req),
      ...(q.access ? { access: q.access } : {}),
      ...(q.year ? { year: q.year } : {}),
      ...(q.language ? { language: { code: q.language } } : {}),
      ...(q.genre ? { genres: { some: { slug: q.genre } } } : {}),
      ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.movie.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.movie.count({ where }),
    ]);
    res.json({
      items: rows.map(movieSummary),
      page: q.page,
      limit: q.limit,
      total,
    });
  }),
);

// GET /movies/:slug
catalogRouter.get(
  "/movies/:slug",
  wrap(async (req, res) => {
    const m = await prisma.movie.findFirst({
      where: { slug: req.params.slug, ...publishedMovie, ...platformWhere(req) },
      include: movieInclude,
    });
    if (!m) throw notFound("Movie not found");
    const related = await prisma.movie.findMany({
      where: {
        ...publishedMovie,
        id: { not: m.id },
        genres: { some: { id: { in: m.genres.map((g) => g.id) } } },
      },
      take: 12,
    });
    res.json(movieDetail(m, related));
  }),
);

// GET /series
catalogRouter.get(
  "/series",
  wrap(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where: Prisma.SeriesWhereInput = {
      ...publishedSeries,
      ...platformWhere(req),
      ...(q.access ? { access: q.access } : {}),
      ...(q.year ? { year: q.year } : {}),
      ...(q.language ? { language: { code: q.language } } : {}),
      ...(q.genre ? { genres: { some: { slug: q.genre } } } : {}),
      ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.series.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.series.count({ where }),
    ]);
    res.json({
      items: rows.map(seriesSummary),
      page: q.page,
      limit: q.limit,
      total,
    });
  }),
);

// GET /series/:slug
catalogRouter.get(
  "/series/:slug",
  wrap(async (req, res) => {
    const s = await prisma.series.findFirst({
      where: { slug: req.params.slug, ...publishedSeries, ...platformWhere(req) },
      include: seriesInclude,
    });
    if (!s) throw notFound("Series not found");
    res.json(seriesDetail(s));
  }),
);

// GET /search?q=
catalogRouter.get(
  "/search",
  wrap(async (req, res) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    const like = { contains: q, mode: "insensitive" as const };
    const [movies, series, cast] = await Promise.all([
      prisma.movie.findMany({
        where: { ...publishedMovie, ...platformWhere(req), title: like },
        take: 20,
      }),
      prisma.series.findMany({
        where: { ...publishedSeries, ...platformWhere(req), title: like },
        take: 20,
      }),
      prisma.castMember.findMany({
        where: { name: like },
        take: 10,
        select: { name: true },
        distinct: ["name"],
      }),
    ]);
    res.json({
      movies: movies.map(movieSummary),
      series: series.map(seriesSummary),
      people: cast.map((c) => c.name),
    });
  }),
);
