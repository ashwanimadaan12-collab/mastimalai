import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { unauthorized, wrap } from "../../lib/http.js";
import { authLimiter } from "../../middleware/index.js";
import {
  requireAdmin,
  ROLE_PERMISSIONS,
  signAdminToken,
  type AdminRole,
} from "./rbac.js";
import { audit } from "./audit.js";

export const adminAuthRouter = Router();

// POST /admin/auth/login
adminAuthRouter.post(
  "/login",
  authLimiter,
  wrap(async (req, res) => {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    // Constant-ish: still run a compare to reduce user-enumeration timing.
    const ok =
      admin && admin.isActive
        ? await bcrypt.compare(password, admin.passwordHash)
        : await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinva");
    if (!admin || !admin.isActive || !ok)
      throw unauthorized("Invalid email or password");

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    const claims = {
      sub: admin.id,
      email: admin.email,
      role: admin.role as AdminRole,
      name: admin.name,
    };
    await audit(claims, {
      action: "admin.login",
      entity: "AdminUser",
      entityId: admin.id,
      summary: `${admin.email} logged in`,
    });
    res.json({
      token: signAdminToken(claims),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: ROLE_PERMISSIONS[admin.role as AdminRole],
      },
    });
  }),
);

// GET /admin/auth/me
adminAuthRouter.get(
  "/me",
  requireAdmin,
  wrap(async (req, res) => {
    const a = req.admin!;
    res.json({
      id: a.sub,
      email: a.email,
      name: a.name,
      role: a.role,
      permissions: ROLE_PERMISSIONS[a.role],
    });
  }),
);
