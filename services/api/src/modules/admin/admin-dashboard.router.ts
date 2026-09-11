import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { wrap } from "../../lib/http.js";
import { requireAdmin, requirePermission } from "./rbac.js";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAdmin);

// GET /admin/dashboard — KPI cards + recent tables (§71).
adminDashboardRouter.get(
  "/",
  requirePermission("dashboard.view"),
  wrap(async (_req, res) => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 864e5);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newUsers24h,
      activeSubs,
      publishedMovies,
      publishedSeries,
      successToday,
      successMonth,
      recentUsers,
      recentPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.subscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
      prisma.movie.count({ where: { status: "PUBLISHED" } }),
      prisma.series.count({ where: { status: "PUBLISHED" } }),
      prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: dayAgo } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, mobile: true, email: true, createdAt: true } }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { plan: { select: { name: true } }, user: { select: { mobile: true } } },
      }),
    ]);

    res.json({
      kpis: {
        totalUsers,
        newUsers24h,
        activeSubscribers: activeSubs,
        publishedTitles: publishedMovies + publishedSeries,
        revenueTodayPaise: successToday._sum.amount ?? 0,
        revenueMonthPaise: successMonth._sum.amount ?? 0,
      },
      recentUsers,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        mobile: p.user.mobile,
        plan: p.plan.name,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  }),
);

// GET /admin/audit — recent audit log (§95).
adminDashboardRouter.get(
  "/audit",
  requirePermission("audit.view"),
  wrap(async (req, res) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
    const items = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: q.limit });
    res.json({ items });
  }),
);
