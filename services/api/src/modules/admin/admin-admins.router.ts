import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound, wrap } from "../../lib/http.js";
import { requireAdmin, requirePermission } from "./rbac.js";
import { audit } from "./audit.js";

// Admin-user management is SUPER_ADMIN-only (admins.manage permission).
export const adminAdminsRouter = Router();
adminAdminsRouter.use(requireAdmin, requirePermission("admins.manage"));

adminAdminsRouter.get(
  "/",
  wrap(async (_req, res) => {
    const items = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    res.json({ items });
  }),
);

adminAdminsRouter.post(
  "/",
  wrap(async (req, res) => {
    const b = z
      .object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(8),
        role: z.enum(["SUPER_ADMIN", "CONTENT_ADMIN", "MARKETING_ADMIN", "SUPPORT_ADMIN", "ANALYST"]),
      })
      .parse(req.body);
    if (await prisma.adminUser.findUnique({ where: { email: b.email } }))
      throw badRequest("Email already in use");
    const admin = await prisma.adminUser.create({
      data: { email: b.email, name: b.name, role: b.role, passwordHash: await bcrypt.hash(b.password, 10) },
    });
    await audit(req.admin, { action: "admin.create", entity: "AdminUser", entityId: admin.id, summary: `Created admin ${admin.email} (${admin.role})` });
    res.status(201).json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, isActive: admin.isActive });
  }),
);

adminAdminsRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const b = z
      .object({
        name: z.string().optional(),
        role: z.enum(["SUPER_ADMIN", "CONTENT_ADMIN", "MARKETING_ADMIN", "SUPPORT_ADMIN", "ANALYST"]).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(8).optional(),
      })
      .parse(req.body);
    const existing = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Admin not found");
    // Guard against self-lockout: a super admin cannot demote/deactivate themselves.
    if (existing.id === req.admin!.sub && (b.role || b.isActive === false))
      throw forbidden("You cannot change your own role or deactivate yourself");
    const admin = await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.role !== undefined ? { role: b.role } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
        ...(b.password ? { passwordHash: await bcrypt.hash(b.password, 10) } : {}),
      },
    });
    await audit(req.admin, { action: "admin.update", entity: "AdminUser", entityId: admin.id, summary: `Updated admin ${admin.email}`, changes: { ...b, password: b.password ? "***" : undefined } });
    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, isActive: admin.isActive });
  }),
);
