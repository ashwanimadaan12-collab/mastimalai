import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { store } from "../../lib/store.js";
import { env } from "../../config/env.js";
import { badRequest, unauthorized, wrap } from "../../lib/http.js";
import { authLimiter } from "../../middleware/index.js";
import {
  hashToken,
  newRefreshToken,
  signAccessToken,
} from "./tokens.js";
import { getEntitlement } from "../billing/entitlement.js";

export const authRouter = Router();

const mobileSchema = z
  .string()
  .regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid Indian mobile number");

function otpKey(mobile: string) {
  return `otp:${mobile}`;
}
function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /auth/continue — the single entry from the login screen.
//  - existing customer WITH an active subscription  -> OTP is sent (next: "otp")
//  - new customer, or one without an active sub      -> no OTP (next: "subscribe")
// So OTP only ever reaches a returning, paying customer; everyone else goes
// straight to the subscription page.
authRouter.post(
  "/continue",
  authLimiter,
  wrap(async (req, res) => {
    const { mobile } = z.object({ mobile: mobileSchema }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { mobile } });
    const active = user ? (await getEntitlement(user.id)).isActive : false;

    if (user && active) {
      const otp = randomOtp();
      await store.set(otpKey(mobile), otp, env.otpTtlSeconds);
      // Real deployment sends via SMS and never returns the OTP.
      const payload: { next: "otp"; sent: true; otp?: string } = { next: "otp", sent: true };
      if (env.otpDevMode) payload.otp = otp;
      return res.json(payload);
    }
    // New or lapsed customer: skip OTP, send them to choose a plan.
    res.json({ next: "subscribe" });
  }),
);

// POST /auth/send-otp
authRouter.post(
  "/send-otp",
  authLimiter,
  wrap(async (req, res) => {
    const { mobile } = z.object({ mobile: mobileSchema }).parse(req.body);
    const otp = randomOtp();
    await store.set(otpKey(mobile), otp, env.otpTtlSeconds);
    // Real deployment sends via SMS provider and NEVER returns the OTP.
    const payload: { sent: true; otp?: string } = { sent: true };
    if (env.otpDevMode) payload.otp = otp;
    res.json(payload);
  }),
);

// POST /auth/verify-otp
authRouter.post(
  "/verify-otp",
  authLimiter,
  wrap(async (req, res) => {
    const { mobile, otp } = z
      .object({ mobile: mobileSchema, otp: z.string().length(6) })
      .parse(req.body);

    const stored = await store.get(otpKey(mobile));
    if (!stored || stored !== otp) throw badRequest("Invalid or expired OTP");
    await store.del(otpKey(mobile));

    // Find or create the user + a default profile on first login.
    let user = await prisma.user.findUnique({
      where: { mobile },
      include: { profiles: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          mobile,
          profiles: { create: [{ name: "Me" }] },
        },
        include: { profiles: true },
      });
    }

    const accessToken = signAccessToken({ sub: user.id, mobile: user.mobile });
    const { token: refreshToken, hash } = newRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        deviceName: req.header("user-agent")?.slice(0, 120) ?? null,
        expiresAt: new Date(Date.now() + 30 * 864e5),
      },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        mobile: user.mobile,
        email: user.email,
        profiles: user.profiles.map((p) => ({
          id: p.id,
          name: p.name,
          isKids: p.isKids,
          avatar: p.avatar,
          language: p.language,
        })),
      },
    });
  }),
);

// POST /auth/refresh
authRouter.post(
  "/refresh",
  wrap(async (req, res) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string().min(10) })
      .parse(req.body);
    const hash = hashToken(refreshToken);
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw unauthorized("Refresh token invalid");
    }
    // Rotate: revoke old, issue new.
    const { token: nextRefresh, hash: nextHash } = newRefreshToken();
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: record.userId,
          tokenHash: nextHash,
          deviceName: record.deviceName,
          expiresAt: new Date(Date.now() + 30 * 864e5),
        },
      }),
    ]);
    const accessToken = signAccessToken({
      sub: record.userId,
      mobile: record.user.mobile,
    });
    res.json({ accessToken, refreshToken: nextRefresh });
  }),
);

// POST /auth/logout
authRouter.post(
  "/logout",
  wrap(async (req, res) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string().min(10) })
      .parse(req.body);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
