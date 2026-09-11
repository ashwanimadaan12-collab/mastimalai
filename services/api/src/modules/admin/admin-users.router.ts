import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { notFound, wrap } from "../../lib/http.js";
import { requireAdmin, requirePermission } from "./rbac.js";
import { getEntitlement } from "../billing/entitlement.js";
import { audit } from "./audit.js";

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAdmin);

// GET /admin/users
adminUsersRouter.get(
  "/",
  requirePermission("users.view"),
  wrap(async (req, res) => {
    const q = z
      .object({
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);
    const where = q.q ? { mobile: { contains: q.q } } : {};
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { profiles: true } } },
      }),
      prisma.user.count({ where }),
    ]);
    // Attach entitlement per user (small page size keeps this cheap).
    const items = await Promise.all(
      rows.map(async (u) => ({
        id: u.id,
        mobile: u.mobile,
        email: u.email,
        profiles: u._count.profiles,
        createdAt: u.createdAt,
        subscription: await getEntitlement(u.id),
      })),
    );
    res.json({ items, total, page: q.page, limit: q.limit });
  }),
);

// GET /admin/users/:id — profile does NOT expose secrets (§42).
adminUsersRouter.get(
  "/:id",
  requirePermission("users.view"),
  wrap(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        profiles: true,
        subscriptions: { orderBy: { createdAt: "desc" }, include: { plan: true } },
        payments: { orderBy: { createdAt: "desc" }, include: { plan: { select: { name: true } } } },
      },
    });
    if (!u) throw notFound("User not found");
    res.json({
      id: u.id,
      mobile: u.mobile,
      email: u.email,
      createdAt: u.createdAt,
      profiles: u.profiles.map((p) => ({ id: p.id, name: p.name, isKids: p.isKids })),
      entitlement: await getEntitlement(u.id),
      subscriptions: u.subscriptions.map((s) => ({
        id: s.id,
        plan: s.plan.name,
        status: s.status,
        startedAt: s.startedAt,
        expiresAt: s.expiresAt,
      })),
      payments: u.payments.map((p) => ({
        id: p.id,
        plan: p.plan.name,
        amount: p.amount,
        status: p.status,
        orderId: p.orderId,
        createdAt: p.createdAt,
      })),
    });
  }),
);

// POST /admin/users/:id/suspend  and  /activate — revoke/restore access.
adminUsersRouter.post(
  "/:id/suspend",
  requirePermission("users.manage"),
  wrap(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) throw notFound("User not found");
    // Suspension = revoke all refresh tokens + expire active subs' access.
    await prisma.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req.admin, { action: "user.suspend", entity: "User", entityId: u.id, summary: `Suspended user ${u.mobile} (revoked sessions)` });
    res.json({ ok: true });
  }),
);
