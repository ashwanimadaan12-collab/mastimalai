// Role-based access control for the admin panel (§37).
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { forbidden, unauthorized } from "../../lib/http.js";

export type AdminRole =
  | "SUPER_ADMIN"
  | "CONTENT_ADMIN"
  | "MARKETING_ADMIN"
  | "SUPPORT_ADMIN"
  | "ANALYST";

// A permission is a coarse capability. Roles map to permission sets.
export type Permission =
  | "dashboard.view"
  | "content.view"
  | "content.manage"
  | "home.view"
  | "home.manage"
  | "users.view"
  | "users.manage"
  | "billing.view"
  | "billing.manage"
  | "admins.manage"
  | "audit.view";

const ALL: Permission[] = [
  "dashboard.view",
  "content.view",
  "content.manage",
  "home.view",
  "home.manage",
  "users.view",
  "users.manage",
  "billing.view",
  "billing.manage",
  "admins.manage",
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  CONTENT_ADMIN: [
    "dashboard.view",
    "content.view",
    "content.manage",
    "home.view",
    "home.manage",
    "audit.view",
  ],
  MARKETING_ADMIN: [
    "dashboard.view",
    "content.view",
    "home.view",
    "home.manage",
    "billing.view",
  ],
  SUPPORT_ADMIN: [
    "dashboard.view",
    "content.view",
    "users.view",
    "users.manage",
    "billing.view",
  ],
  ANALYST: ["dashboard.view", "content.view", "users.view", "billing.view", "audit.view"],
};

export function roleHas(role: AdminRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export interface AdminClaims {
  sub: string;
  email: string;
  role: AdminRole;
  name: string;
}

export function signAdminToken(claims: AdminClaims): string {
  return jwt.sign(claims, env.adminJwtSecret, {
    expiresIn: env.adminJwtTtl as jwt.SignOptions["expiresIn"],
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminClaims;
    }
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next(unauthorized());
  try {
    req.admin = jwt.verify(header.slice(7), env.adminJwtSecret) as AdminClaims;
    next();
  } catch {
    next(unauthorized("Invalid or expired admin session"));
  }
}

// Guard factory: require a specific permission.
export function requirePermission(perm: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(unauthorized());
    if (!roleHas(req.admin.role, perm))
      return next(forbidden(`Your role (${req.admin.role}) lacks ${perm}`));
    next();
  };
}
