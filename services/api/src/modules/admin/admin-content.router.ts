import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound, wrap } from "../../lib/http.js";
import path from "node:path";
import { requireAdmin, requirePermission } from "./rbac.js";
import { audit } from "./audit.js";
import { env } from "../../config/env.js";
import { ffmpegAvailable } from "../streaming/transcode.js";
import { startTranscode, saveRawUpload, generateSample, uploadDir } from "../streaming/jobs.js";
import { safeUpstreamUrl } from "../streaming/ssrf.js";

export const adminContentRouter = Router();
adminContentRouter.use(requireAdmin);

const view = requirePermission("content.view");
const manage = requirePermission("content.manage");

// ---------- shared validation ----------
const castItem = z.object({
  name: z.string().min(1),
  character: z.string().optional().nullable(),
  role: z.enum(["ACTOR", "DIRECTOR", "PRODUCER"]).default("ACTOR"),
  order: z.number().int().default(0),
});

const movieBody = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "lowercase, digits, hyphens only"),
  description: z.string().optional().nullable(),
  poster: z.string().optional().nullable(),
  backdrop: z.string().optional().nullable(),
  trailerUrl: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  durationSec: z.number().int().optional().nullable(),
  ageRating: z.string().optional().nullable(),
  rating: z.number().optional().nullable(),
  access: z.enum(["FREE", "PREMIUM"]).default("FREE"),
  status: z
    .enum(["DRAFT", "PROCESSING", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"])
    .default("DRAFT"),
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  isTop10: z.boolean().default(false),
  platforms: z.array(z.enum(["WEB", "ANDROID"])).default(["WEB", "ANDROID"]),
  publishAt: z.string().datetime().optional().nullable(),
  languageId: z.string().optional().nullable(),
  genreIds: z.array(z.string()).default([]),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  ogImage: z.string().optional().nullable(),
  streamUrl: z.string().optional().nullable(), // dev: direct HLS URL for the VideoAsset
  cast: z.array(castItem).default([]),
});

function movieData(b: z.infer<typeof movieBody>): Prisma.MovieUncheckedCreateInput {
  return {
    title: b.title,
    slug: b.slug,
    description: b.description ?? null,
    poster: b.poster ?? null,
    backdrop: b.backdrop ?? null,
    trailerUrl: b.trailerUrl ?? null,
    year: b.year ?? null,
    durationSec: b.durationSec ?? null,
    ageRating: b.ageRating ?? null,
    rating: b.rating ?? null,
    access: b.access,
    status: b.status,
    isFeatured: b.isFeatured,
    isTrending: b.isTrending,
    isTop10: b.isTop10,
    platforms: b.platforms,
    publishAt: b.publishAt ? new Date(b.publishAt) : null,
    languageId: b.languageId ?? null,
    seoTitle: b.seoTitle ?? null,
    seoDescription: b.seoDescription ?? null,
    ogImage: b.ogImage ?? null,
  };
}

// Upsert the VideoAsset for a movie/episode when a stream URL is provided.
async function syncVideoAsset(
  currentAssetId: string | null,
  streamUrl: string | null | undefined,
  durationSec?: number | null,
): Promise<string | null> {
  if (streamUrl === undefined) return currentAssetId; // untouched
  if (!streamUrl) {
    if (currentAssetId) await prisma.videoAsset.delete({ where: { id: currentAssetId } }).catch(() => {});
    return null;
  }
  if (currentAssetId) {
    await prisma.videoAsset.update({
      where: { id: currentAssetId },
      data: { streamUrl, status: "READY", durationSec: durationSec ?? undefined },
    });
    return currentAssetId;
  }
  const asset = await prisma.videoAsset.create({
    data: { streamUrl, status: "READY", durationSec: durationSec ?? null },
  });
  return asset.id;
}

// ================= MOVIES =================
adminContentRouter.get(
  "/movies",
  view,
  wrap(async (req, res) => {
    const q = z
      .object({
        status: z.string().optional(),
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);
    const where: Prisma.MovieWhereInput = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.movie.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { language: true, genres: true },
      }),
      prisma.movie.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit });
  }),
);

adminContentRouter.get(
  "/movies/:id",
  view,
  wrap(async (req, res) => {
    const m = await prisma.movie.findUnique({
      where: { id: req.params.id },
      include: { language: true, genres: true, cast: { orderBy: { order: "asc" } }, videoAsset: true },
    });
    if (!m) throw notFound("Movie not found");
    res.json(m);
  }),
);

adminContentRouter.post(
  "/movies",
  manage,
  wrap(async (req, res) => {
    const b = movieBody.parse(req.body);
    const dup = await prisma.movie.findUnique({ where: { slug: b.slug } });
    if (dup) throw badRequest("Slug already in use");
    const assetId = await syncVideoAsset(null, b.streamUrl, b.durationSec);
    const m = await prisma.movie.create({
      data: {
        ...movieData(b),
        videoAssetId: assetId,
        genres: { connect: b.genreIds.map((id) => ({ id })) },
        cast: { create: b.cast },
      },
    });
    await audit(req.admin, {
      action: "movie.create",
      entity: "Movie",
      entityId: m.id,
      summary: `Created movie "${m.title}"`,
    });
    res.status(201).json(m);
  }),
);

adminContentRouter.patch(
  "/movies/:id",
  manage,
  wrap(async (req, res) => {
    const b = movieBody.partial().parse(req.body);
    const existing = await prisma.movie.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Movie not found");
    if (b.slug && b.slug !== existing.slug) {
      const dup = await prisma.movie.findUnique({ where: { slug: b.slug } });
      if (dup) throw badRequest("Slug already in use");
    }
    const assetId = await syncVideoAsset(
      existing.videoAssetId,
      b.streamUrl,
      b.durationSec ?? existing.durationSec,
    );
    const data: Prisma.MovieUncheckedUpdateInput = {
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.slug !== undefined ? { slug: b.slug } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.poster !== undefined ? { poster: b.poster } : {}),
      ...(b.backdrop !== undefined ? { backdrop: b.backdrop } : {}),
      ...(b.trailerUrl !== undefined ? { trailerUrl: b.trailerUrl } : {}),
      ...(b.year !== undefined ? { year: b.year } : {}),
      ...(b.durationSec !== undefined ? { durationSec: b.durationSec } : {}),
      ...(b.ageRating !== undefined ? { ageRating: b.ageRating } : {}),
      ...(b.rating !== undefined ? { rating: b.rating } : {}),
      ...(b.access !== undefined ? { access: b.access } : {}),
      ...(b.status !== undefined ? { status: b.status } : {}),
      ...(b.isFeatured !== undefined ? { isFeatured: b.isFeatured } : {}),
      ...(b.isTrending !== undefined ? { isTrending: b.isTrending } : {}),
      ...(b.isTop10 !== undefined ? { isTop10: b.isTop10 } : {}),
      ...(b.platforms !== undefined ? { platforms: b.platforms } : {}),
      ...(b.publishAt !== undefined ? { publishAt: b.publishAt ? new Date(b.publishAt) : null } : {}),
      ...(b.languageId !== undefined ? { languageId: b.languageId } : {}),
      ...(b.seoTitle !== undefined ? { seoTitle: b.seoTitle } : {}),
      ...(b.seoDescription !== undefined ? { seoDescription: b.seoDescription } : {}),
      ...(b.ogImage !== undefined ? { ogImage: b.ogImage } : {}),
      videoAssetId: assetId,
      ...(b.genreIds ? { genres: { set: b.genreIds.map((id) => ({ id })) } } : {}),
    };
    const m = await prisma.movie.update({ where: { id: existing.id }, data });
    if (b.cast) {
      await prisma.castMember.deleteMany({ where: { movieId: m.id } });
      await prisma.castMember.createMany({
        data: b.cast.map((c) => ({ ...c, movieId: m.id })),
      });
    }
    await audit(req.admin, {
      action: "movie.update",
      entity: "Movie",
      entityId: m.id,
      summary: `Updated movie "${m.title}"`,
      changes: b,
    });
    res.json(m);
  }),
);

adminContentRouter.delete(
  "/movies/:id",
  manage,
  wrap(async (req, res) => {
    const m = await prisma.movie.findUnique({ where: { id: req.params.id } });
    if (!m) throw notFound("Movie not found");
    await prisma.movie.delete({ where: { id: m.id } });
    await audit(req.admin, {
      action: "movie.delete",
      entity: "Movie",
      entityId: m.id,
      summary: `Deleted movie "${m.title}"`,
    });
    res.json({ ok: true });
  }),
);

// ================= VIDEO / TRANSCODE =================
// Read a single episode's video asset (for the transcode status panel).
adminContentRouter.get(
  "/episodes/:id/asset",
  view,
  wrap(async (req, res) => {
    const e = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { videoAsset: true },
    });
    if (!e) throw notFound("Episode not found");
    res.json({ asset: e.videoAsset });
  }),
);

// Whether the ffmpeg worker is available on this host.
adminContentRouter.get(
  "/transcoder/status",
  view,
  wrap(async (_req, res) => res.json({ ffmpeg: await ffmpegAvailable() })),
);

async function contentExists(kind: "movie" | "episode", id: string) {
  return kind === "movie"
    ? prisma.movie.findUnique({ where: { id } })
    : prisma.episode.findUnique({ where: { id } });
}

// Upload a source video (raw body) → transcode to an HLS ladder in the background.
// The client sends the file as the request body with ?filename=... (octet-stream),
// so express.json() leaves the stream untouched.
adminContentRouter.post(
  "/:kind(movie|episode)/:id/video",
  manage,
  wrap(async (req, res) => {
    const kind = req.params.kind as "movie" | "episode";
    if (!(await contentExists(kind, req.params.id))) throw notFound(`${kind} not found`);
    if (!(await ffmpegAvailable())) throw badRequest("ffmpeg is not available on the server");

    const rawName = String(req.query.filename ?? "source.mp4");
    const ext = (path.extname(rawName) || ".mp4").replace(/[^.a-z0-9]/gi, "");
    const dest = path.join(uploadDir, `${req.params.id}-${Date.now()}${ext}`);
    const bytes = await saveRawUpload(req, dest, env.uploadMaxBytes);
    const assetId = await startTranscode(kind, req.params.id, dest);
    await audit(req.admin, {
      action: `${kind}.video.upload`,
      entity: kind === "movie" ? "Movie" : "Episode",
      entityId: req.params.id,
      summary: `Uploaded ${(bytes / 1e6).toFixed(1)} MB source → transcoding`,
    });
    res.status(202).json({ assetId, status: "PROCESSING", bytes });
  }),
);

// Transcode directly from a remote HLS/video URL — ffmpeg pulls it and rebuilds
// a small-segment 240p–1080p ABR ladder served locally. Great for optimising a
// slow/single-quality source stream.
adminContentRouter.post(
  "/:kind(movie|episode)/:id/transcode-url",
  manage,
  wrap(async (req, res) => {
    const kind = req.params.kind as "movie" | "episode";
    if (!(await contentExists(kind, req.params.id))) throw notFound(`${kind} not found`);
    if (!(await ffmpegAvailable())) throw badRequest("ffmpeg is not available on the server");
    const { url } = z.object({ url: z.string().url() }).parse(req.body);
    if (!(await safeUpstreamUrl(url)))
      throw badRequest("URL host is not allowed (must be a public http/https address)");
    // The source "path" is the URL itself; ffmpeg reads it directly.
    const assetId = await startTranscode(kind, req.params.id, url);
    await audit(req.admin, {
      action: `${kind}.video.transcodeUrl`,
      entity: kind === "movie" ? "Movie" : "Episode",
      entityId: req.params.id,
      summary: `Transcoding from URL ${url.slice(0, 80)}`,
    });
    res.status(202).json({ assetId, status: "PROCESSING" });
  }),
);

// Generate a synthetic test clip and transcode it (demo, no upload needed).
adminContentRouter.post(
  "/:kind(movie|episode)/:id/sample-video",
  manage,
  wrap(async (req, res) => {
    const kind = req.params.kind as "movie" | "episode";
    if (!(await contentExists(kind, req.params.id))) throw notFound(`${kind} not found`);
    if (!(await ffmpegAvailable())) throw badRequest("ffmpeg is not available on the server");
    const seconds = Math.min(120, Math.max(5, Number(req.body?.seconds ?? 20)));
    const dest = path.join(uploadDir, `${req.params.id}-sample-${Date.now()}.mp4`);
    await generateSample(dest, seconds, 720);
    const assetId = await startTranscode(kind, req.params.id, dest);
    await audit(req.admin, {
      action: `${kind}.video.sample`,
      entity: kind === "movie" ? "Movie" : "Episode",
      entityId: req.params.id,
      summary: `Generated ${seconds}s sample → transcoding`,
    });
    res.status(202).json({ assetId, status: "PROCESSING" });
  }),
);

// ================= SERIES =================
const seriesBody = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().nullable(),
  poster: z.string().optional().nullable(),
  backdrop: z.string().optional().nullable(),
  trailerUrl: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  ageRating: z.string().optional().nullable(),
  access: z.enum(["FREE", "PREMIUM"]).default("PREMIUM"),
  status: z
    .enum(["DRAFT", "PROCESSING", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"])
    .default("DRAFT"),
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  isTop10: z.boolean().default(false),
  platforms: z.array(z.enum(["WEB", "ANDROID"])).default(["WEB", "ANDROID"]),
  languageId: z.string().optional().nullable(),
  genreIds: z.array(z.string()).default([]),
  cast: z.array(castItem).default([]),
});

adminContentRouter.get(
  "/series",
  view,
  wrap(async (req, res) => {
    const q = z
      .object({
        status: z.string().optional(),
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);
    const where: Prisma.SeriesWhereInput = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.series.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { language: true, genres: true, _count: { select: { seasons: true } } },
      }),
      prisma.series.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit });
  }),
);

adminContentRouter.get(
  "/series/:id",
  view,
  wrap(async (req, res) => {
    const s = await prisma.series.findUnique({
      where: { id: req.params.id },
      include: {
        language: true,
        genres: true,
        cast: { orderBy: { order: "asc" } },
        seasons: {
          orderBy: { number: "asc" },
          include: { episodes: { orderBy: { number: "asc" }, include: { videoAsset: true } } },
        },
      },
    });
    if (!s) throw notFound("Series not found");
    res.json(s);
  }),
);

adminContentRouter.post(
  "/series",
  manage,
  wrap(async (req, res) => {
    const b = seriesBody.parse(req.body);
    if (await prisma.series.findUnique({ where: { slug: b.slug } }))
      throw badRequest("Slug already in use");
    const s = await prisma.series.create({
      data: {
        title: b.title,
        slug: b.slug,
        description: b.description ?? null,
        poster: b.poster ?? null,
        backdrop: b.backdrop ?? null,
        trailerUrl: b.trailerUrl ?? null,
        year: b.year ?? null,
        ageRating: b.ageRating ?? null,
        access: b.access,
        status: b.status,
        isFeatured: b.isFeatured,
        isTrending: b.isTrending,
        isTop10: b.isTop10,
        platforms: b.platforms,
        languageId: b.languageId ?? null,
        genres: { connect: b.genreIds.map((id) => ({ id })) },
        cast: { create: b.cast },
      },
    });
    await audit(req.admin, { action: "series.create", entity: "Series", entityId: s.id, summary: `Created series "${s.title}"` });
    res.status(201).json(s);
  }),
);

adminContentRouter.patch(
  "/series/:id",
  manage,
  wrap(async (req, res) => {
    const b = seriesBody.partial().parse(req.body);
    const existing = await prisma.series.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Series not found");
    const s = await prisma.series.update({
      where: { id: existing.id },
      data: {
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(b.slug !== undefined ? { slug: b.slug } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.poster !== undefined ? { poster: b.poster } : {}),
        ...(b.backdrop !== undefined ? { backdrop: b.backdrop } : {}),
        ...(b.trailerUrl !== undefined ? { trailerUrl: b.trailerUrl } : {}),
        ...(b.year !== undefined ? { year: b.year } : {}),
        ...(b.ageRating !== undefined ? { ageRating: b.ageRating } : {}),
        ...(b.access !== undefined ? { access: b.access } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.isFeatured !== undefined ? { isFeatured: b.isFeatured } : {}),
        ...(b.isTrending !== undefined ? { isTrending: b.isTrending } : {}),
        ...(b.isTop10 !== undefined ? { isTop10: b.isTop10 } : {}),
        ...(b.platforms !== undefined ? { platforms: b.platforms } : {}),
        ...(b.languageId !== undefined ? { languageId: b.languageId } : {}),
        ...(b.genreIds ? { genres: { set: b.genreIds.map((id) => ({ id })) } } : {}),
      },
    });
    if (b.cast) {
      await prisma.castMember.deleteMany({ where: { seriesId: s.id } });
      await prisma.castMember.createMany({ data: b.cast.map((c) => ({ ...c, seriesId: s.id })) });
    }
    await audit(req.admin, { action: "series.update", entity: "Series", entityId: s.id, summary: `Updated series "${s.title}"`, changes: b });
    res.json(s);
  }),
);

adminContentRouter.delete(
  "/series/:id",
  manage,
  wrap(async (req, res) => {
    const s = await prisma.series.findUnique({ where: { id: req.params.id } });
    if (!s) throw notFound("Series not found");
    await prisma.series.delete({ where: { id: s.id } });
    await audit(req.admin, { action: "series.delete", entity: "Series", entityId: s.id, summary: `Deleted series "${s.title}"` });
    res.json({ ok: true });
  }),
);

// ---- Seasons ----
adminContentRouter.post(
  "/series/:id/seasons",
  manage,
  wrap(async (req, res) => {
    const b = z.object({ number: z.number().int().min(1), title: z.string().optional() }).parse(req.body);
    const series = await prisma.series.findUnique({ where: { id: req.params.id } });
    if (!series) throw notFound("Series not found");
    const season = await prisma.season.create({
      data: { seriesId: series.id, number: b.number, title: b.title ?? `Season ${b.number}` },
    });
    await audit(req.admin, { action: "season.create", entity: "Season", entityId: season.id, summary: `Added Season ${b.number} to "${series.title}"` });
    res.status(201).json(season);
  }),
);

adminContentRouter.delete(
  "/seasons/:id",
  manage,
  wrap(async (req, res) => {
    const season = await prisma.season.findUnique({ where: { id: req.params.id } });
    if (!season) throw notFound("Season not found");
    await prisma.season.delete({ where: { id: season.id } });
    await audit(req.admin, { action: "season.delete", entity: "Season", entityId: season.id, summary: `Deleted a season` });
    res.json({ ok: true });
  }),
);

// ---- Episodes ----
const episodeBody = z.object({
  number: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  durationSec: z.number().int().optional().nullable(),
  introEndSec: z.number().int().optional().nullable(),
  access: z.enum(["FREE", "PREMIUM"]).default("PREMIUM"),
  status: z
    .enum(["DRAFT", "PROCESSING", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"])
    .default("PUBLISHED"),
  streamUrl: z.string().optional().nullable(),
});

adminContentRouter.post(
  "/seasons/:id/episodes",
  manage,
  wrap(async (req, res) => {
    const b = episodeBody.parse(req.body);
    const season = await prisma.season.findUnique({ where: { id: req.params.id } });
    if (!season) throw notFound("Season not found");
    const assetId = await syncVideoAsset(null, b.streamUrl, b.durationSec);
    const ep = await prisma.episode.create({
      data: {
        seasonId: season.id,
        number: b.number,
        title: b.title,
        description: b.description ?? null,
        thumbnail: b.thumbnail ?? null,
        durationSec: b.durationSec ?? null,
        introEndSec: b.introEndSec ?? null,
        access: b.access,
        status: b.status,
        videoAssetId: assetId,
      },
    });
    await audit(req.admin, { action: "episode.create", entity: "Episode", entityId: ep.id, summary: `Added episode "${ep.title}"` });
    res.status(201).json(ep);
  }),
);

adminContentRouter.patch(
  "/episodes/:id",
  manage,
  wrap(async (req, res) => {
    const b = episodeBody.partial().parse(req.body);
    const existing = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Episode not found");
    const assetId = await syncVideoAsset(existing.videoAssetId, b.streamUrl, b.durationSec ?? existing.durationSec);
    const ep = await prisma.episode.update({
      where: { id: existing.id },
      data: {
        ...(b.number !== undefined ? { number: b.number } : {}),
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.thumbnail !== undefined ? { thumbnail: b.thumbnail } : {}),
        ...(b.durationSec !== undefined ? { durationSec: b.durationSec } : {}),
        ...(b.introEndSec !== undefined ? { introEndSec: b.introEndSec } : {}),
        ...(b.access !== undefined ? { access: b.access } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        videoAssetId: assetId,
      },
    });
    await audit(req.admin, { action: "episode.update", entity: "Episode", entityId: ep.id, summary: `Updated episode "${ep.title}"`, changes: b });
    res.json(ep);
  }),
);

adminContentRouter.delete(
  "/episodes/:id",
  manage,
  wrap(async (req, res) => {
    const ep = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!ep) throw notFound("Episode not found");
    await prisma.episode.delete({ where: { id: ep.id } });
    await audit(req.admin, { action: "episode.delete", entity: "Episode", entityId: ep.id, summary: `Deleted episode "${ep.title}"` });
    res.json({ ok: true });
  }),
);

// ---- Taxonomy (genres, languages) ----
adminContentRouter.get(
  "/genres",
  view,
  wrap(async (_req, res) => res.json({ items: await prisma.genre.findMany({ orderBy: { name: "asc" } }) })),
);
adminContentRouter.post(
  "/genres",
  manage,
  wrap(async (req, res) => {
    const b = z.object({ name: z.string().min(1), slug: z.string().regex(/^[a-z0-9-]+$/) }).parse(req.body);
    const g = await prisma.genre.create({ data: b });
    await audit(req.admin, { action: "genre.create", entity: "Genre", entityId: g.id, summary: `Created genre "${g.name}"` });
    res.status(201).json(g);
  }),
);
adminContentRouter.get(
  "/languages",
  view,
  wrap(async (_req, res) => res.json({ items: await prisma.language.findMany({ orderBy: { name: "asc" } }) })),
);
adminContentRouter.post(
  "/languages",
  manage,
  wrap(async (req, res) => {
    const b = z.object({ name: z.string().min(1), code: z.string().min(2).max(10) }).parse(req.body);
    const l = await prisma.language.create({ data: b });
    await audit(req.admin, { action: "language.create", entity: "Language", entityId: l.id, summary: `Created language "${l.name}"` });
    res.status(201).json(l);
  }),
);
