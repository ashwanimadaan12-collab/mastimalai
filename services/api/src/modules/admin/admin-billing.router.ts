import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { notFound, wrap } from "../../lib/http.js";
import { requireAdmin, requirePermission } from "./rbac.js";
import { audit } from "./audit.js";

export const adminBillingRouter = Router();
adminBillingRouter.use(requireAdmin);
const view = requirePermission("billing.view");
const manage = requirePermission("billing.manage");

const planBody = z.object({
  name: z.string().min(1),
  priceInPaise: z.number().int().min(0),
  compareAtPriceInPaise: z.number().int().min(0).optional().nullable(),
  currency: z.string().default("INR"),
  durationDays: z.number().int().min(1),
  description: z.string().optional().nullable(),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isRecommended: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  platforms: z.array(z.enum(["WEB", "ANDROID"])).default(["WEB", "ANDROID"]),
});

// ---- Plans CRUD ----
adminBillingRouter.get(
  "/plans",
  view,
  wrap(async (_req, res) => {
    res.json({ items: await prisma.subscriptionPlan.findMany({ orderBy: { displayOrder: "asc" } }) });
  }),
);

adminBillingRouter.post(
  "/plans",
  manage,
  wrap(async (req, res) => {
    const b = planBody.parse(req.body);
    const p = await prisma.subscriptionPlan.create({ data: b });
    await audit(req.admin, { action: "plan.create", entity: "SubscriptionPlan", entityId: p.id, summary: `Created plan "${p.name}"` });
    res.status(201).json(p);
  }),
);

adminBillingRouter.patch(
  "/plans/:id",
  manage,
  wrap(async (req, res) => {
    const b = planBody.partial().parse(req.body);
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Plan not found");
    const p = await prisma.subscriptionPlan.update({ where: { id: existing.id }, data: b });
    await audit(req.admin, { action: "plan.update", entity: "SubscriptionPlan", entityId: p.id, summary: `Updated plan "${p.name}"`, changes: b });
    res.json(p);
  }),
);

adminBillingRouter.delete(
  "/plans/:id",
  manage,
  wrap(async (req, res) => {
    const p = await prisma.subscriptionPlan.findUnique({ where: { id: req.params.id }, include: { _count: { select: { subscriptions: true } } } });
    if (!p) throw notFound("Plan not found");
    // Keep history intact: deactivate instead of hard-deleting a plan with subs.
    if (p._count.subscriptions > 0) {
      const upd = await prisma.subscriptionPlan.update({ where: { id: p.id }, data: { isActive: false } });
      await audit(req.admin, { action: "plan.deactivate", entity: "SubscriptionPlan", entityId: p.id, summary: `Deactivated plan "${p.name}" (has subscriptions)` });
      return res.json({ ok: true, deactivated: true, plan: upd });
    }
    await prisma.subscriptionPlan.delete({ where: { id: p.id } });
    await audit(req.admin, { action: "plan.delete", entity: "SubscriptionPlan", entityId: p.id, summary: `Deleted plan "${p.name}"` });
    res.json({ ok: true });
  }),
);

// ---- Subscriptions & payments (read/filter, §43) ----
adminBillingRouter.get(
  "/subscriptions",
  view,
  wrap(async (req, res) => {
    const q = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);
    const where = q.status ? { status: q.status as never } : {};
    const [rows, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { plan: { select: { name: true } }, user: { select: { mobile: true } } },
      }),
      prisma.subscription.count({ where }),
    ]);
    res.json({
      items: rows.map((s) => ({
        id: s.id,
        mobile: s.user.mobile,
        plan: s.plan.name,
        status: s.status,
        startedAt: s.startedAt,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  }),
);

adminBillingRouter.get(
  "/payments",
  view,
  wrap(async (req, res) => {
    const q = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);
    const where = q.status ? { status: q.status as never } : {};
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { plan: { select: { name: true } }, user: { select: { mobile: true } } },
      }),
      prisma.payment.count({ where }),
    ]);
    res.json({
      items: rows.map((p) => ({
        id: p.id,
        mobile: p.user.mobile,
        plan: p.plan.name,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        orderId: p.orderId,
        createdAt: p.createdAt,
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  }),
);
