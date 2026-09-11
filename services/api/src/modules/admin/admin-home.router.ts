import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { notFound, wrap } from "../../lib/http.js";
import { requireAdmin, requirePermission } from "./rbac.js";
import { audit } from "./audit.js";

export const adminHomeRouter = Router();
adminHomeRouter.use(requireAdmin);
const view = requirePermission("home.view");
const manage = requirePermission("home.manage");

// GET /admin/home/sections — all sections with items + hero, ordered.
adminHomeRouter.get(
  "/sections",
  view,
  wrap(async (_req, res) => {
    const sections = await prisma.homeSection.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        heroItems: { orderBy: { order: "asc" } },
        items: { orderBy: { order: "asc" } },
      },
    });
    // Resolve item titles for the editor.
    const movieIds = sections.flatMap((s) => s.items.map((i) => i.movieId).filter(Boolean)) as string[];
    const seriesIds = sections.flatMap((s) => s.items.map((i) => i.seriesId).filter(Boolean)) as string[];
    const [movies, series] = await Promise.all([
      prisma.movie.findMany({ where: { id: { in: movieIds } }, select: { id: true, title: true, poster: true } }),
      prisma.series.findMany({ where: { id: { in: seriesIds } }, select: { id: true, title: true, poster: true } }),
    ]);
    const mMap = new Map(movies.map((m) => [m.id, m]));
    const sMap = new Map(series.map((s) => [s.id, s]));
    res.json({
      items: sections.map((s) => ({
        ...s,
        items: s.items.map((i) => ({
          ...i,
          title: i.movieId ? mMap.get(i.movieId)?.title : i.seriesId ? sMap.get(i.seriesId)?.title : null,
          kind: i.movieId ? "movie" : "series",
        })),
      })),
    });
  }),
);

adminHomeRouter.post(
  "/sections",
  manage,
  wrap(async (req, res) => {
    const b = z
      .object({
        title: z.string().min(1),
        type: z.enum(["HERO", "CAROUSEL", "TOP10", "CONTINUE_WATCHING"]).default("CAROUSEL"),
      })
      .parse(req.body);
    const max = await prisma.homeSection.aggregate({ _max: { displayOrder: true } });
    const section = await prisma.homeSection.create({
      data: { title: b.title, type: b.type, displayOrder: (max._max.displayOrder ?? 0) + 1 },
    });
    await audit(req.admin, { action: "home.section.create", entity: "HomeSection", entityId: section.id, summary: `Created section "${b.title}"` });
    res.status(201).json(section);
  }),
);

adminHomeRouter.patch(
  "/sections/:id",
  manage,
  wrap(async (req, res) => {
    const b = z
      .object({ title: z.string().optional(), isActive: z.boolean().optional() })
      .parse(req.body);
    const existing = await prisma.homeSection.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Section not found");
    const s = await prisma.homeSection.update({ where: { id: existing.id }, data: b });
    await audit(req.admin, { action: "home.section.update", entity: "HomeSection", entityId: s.id, summary: `Updated section "${s.title}"`, changes: b });
    res.json(s);
  }),
);

adminHomeRouter.delete(
  "/sections/:id",
  manage,
  wrap(async (req, res) => {
    const s = await prisma.homeSection.findUnique({ where: { id: req.params.id } });
    if (!s) throw notFound("Section not found");
    await prisma.homeSection.delete({ where: { id: s.id } });
    await audit(req.admin, { action: "home.section.delete", entity: "HomeSection", entityId: s.id, summary: `Deleted section "${s.title}"` });
    res.json({ ok: true });
  }),
);

// Reorder all sections at once (§40 drag-order).
adminHomeRouter.post(
  "/sections/reorder",
  manage,
  wrap(async (req, res) => {
    const b = z.object({ order: z.array(z.string()) }).parse(req.body);
    await prisma.$transaction(
      b.order.map((id, i) =>
        prisma.homeSection.update({ where: { id }, data: { displayOrder: i } }),
      ),
    );
    await audit(req.admin, { action: "home.section.reorder", entity: "HomeSection", summary: `Reordered ${b.order.length} sections` });
    res.json({ ok: true });
  }),
);

// Replace the content items of a carousel/top10 section, in order.
adminHomeRouter.put(
  "/sections/:id/items",
  manage,
  wrap(async (req, res) => {
    const b = z
      .object({
        items: z.array(
          z
            .object({ movieId: z.string().optional(), seriesId: z.string().optional() })
            .refine((i) => !!i.movieId !== !!i.seriesId, { message: "one of movieId/seriesId" }),
        ),
      })
      .parse(req.body);
    const section = await prisma.homeSection.findUnique({ where: { id: req.params.id } });
    if (!section) throw notFound("Section not found");
    await prisma.$transaction([
      prisma.homeSectionItem.deleteMany({ where: { sectionId: section.id } }),
      prisma.homeSectionItem.createMany({
        data: b.items.map((i, idx) => ({
          sectionId: section.id,
          movieId: i.movieId ?? null,
          seriesId: i.seriesId ?? null,
          order: idx,
        })),
      }),
    ]);
    await audit(req.admin, { action: "home.section.items", entity: "HomeSection", entityId: section.id, summary: `Set ${b.items.length} items on "${section.title}"` });
    res.json({ ok: true });
  }),
);

// ---- Hero / banners (§41) ----
const heroBody = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  backdrop: z.string().optional().nullable(),
  poster: z.string().optional().nullable(),
  trailerUrl: z.string().optional().nullable(),
  ctaLabel: z.string().optional().nullable(),
  targetKind: z.enum(["movie", "series"]).optional().nullable(),
  targetSlug: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
});

adminHomeRouter.post(
  "/sections/:id/hero",
  manage,
  wrap(async (req, res) => {
    const b = heroBody.parse(req.body);
    const section = await prisma.homeSection.findUnique({ where: { id: req.params.id } });
    if (!section) throw notFound("Section not found");
    const max = await prisma.heroItem.aggregate({ where: { sectionId: section.id }, _max: { order: true } });
    const hero = await prisma.heroItem.create({
      data: {
        sectionId: section.id,
        title: b.title,
        subtitle: b.subtitle ?? null,
        description: b.description ?? null,
        backdrop: b.backdrop ?? null,
        poster: b.poster ?? null,
        trailerUrl: b.trailerUrl ?? null,
        ctaLabel: b.ctaLabel ?? null,
        targetKind: b.targetKind ?? null,
        targetSlug: b.targetSlug ?? null,
        isActive: b.isActive,
        startAt: b.startAt ? new Date(b.startAt) : null,
        endAt: b.endAt ? new Date(b.endAt) : null,
        order: (max._max.order ?? 0) + 1,
      },
    });
    await audit(req.admin, { action: "hero.create", entity: "HeroItem", entityId: hero.id, summary: `Created hero banner "${b.title}"` });
    res.status(201).json(hero);
  }),
);

adminHomeRouter.patch(
  "/hero/:id",
  manage,
  wrap(async (req, res) => {
    const b = heroBody.partial().parse(req.body);
    const existing = await prisma.heroItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Hero item not found");
    const hero = await prisma.heroItem.update({
      where: { id: existing.id },
      data: {
        ...b,
        startAt: b.startAt !== undefined ? (b.startAt ? new Date(b.startAt) : null) : undefined,
        endAt: b.endAt !== undefined ? (b.endAt ? new Date(b.endAt) : null) : undefined,
      },
    });
    await audit(req.admin, { action: "hero.update", entity: "HeroItem", entityId: hero.id, summary: `Updated hero banner "${hero.title}"`, changes: b });
    res.json(hero);
  }),
);

adminHomeRouter.delete(
  "/hero/:id",
  manage,
  wrap(async (req, res) => {
    const h = await prisma.heroItem.findUnique({ where: { id: req.params.id } });
    if (!h) throw notFound("Hero item not found");
    await prisma.heroItem.delete({ where: { id: h.id } });
    await audit(req.admin, { action: "hero.delete", entity: "HeroItem", entityId: h.id, summary: `Deleted hero banner "${h.title}"` });
    res.json({ ok: true });
  }),
);
