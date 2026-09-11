import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError, unauthorized, forbidden, badRequest } from "../lib/http.js";
import { verifyAccessToken } from "../modules/auth/tokens.js";
import { prisma } from "../lib/prisma.js";

// ---- Augment Express request with auth context ----
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      mobile?: string;
      profileId?: string;
    }
  }
}

// ---- Auth guard: requires a valid access token ----
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next(unauthorized());
  try {
    const claims = verifyAccessToken(header.slice(7));
    req.userId = claims.sub;
    req.mobile = claims.mobile;
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}

// ---- Profile resolver: requires X-Profile-Id belonging to the user ----
export async function requireProfile(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.userId) return next(unauthorized());
    const profileId = req.header("x-profile-id");
    if (!profileId) return next(badRequest("X-Profile-Id header required"));
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: req.userId },
      select: { id: true },
    });
    if (!profile) return next(forbidden("Profile does not belong to user"));
    req.profileId = profile.id;
    next();
  } catch (e) {
    next(e);
  }
}

// ---- Simple in-memory rate limiter (per IP + bucket) ----
function makeLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return next(new HttpError(429, "RATE_LIMITED", "Too many requests"));
    }
    next();
  };
}

export const authLimiter = makeLimiter(60_000, 10); // 10/min per endpoint
export const globalLimiter = makeLimiter(60_000, 300); // 300/min

// ---- Central error handler ----
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  return res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong" },
  });
}
