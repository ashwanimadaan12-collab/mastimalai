import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound, wrap } from "../../lib/http.js";
import { requireAuth, authLimiter } from "../../middleware/index.js";
import { payments } from "../../providers/index.js";
import { getEntitlement } from "./entitlement.js";
import { platformWhere } from "../../lib/platform.js";
import { signAccessToken, newRefreshToken } from "../auth/tokens.js";

export const plansRouter = Router();

// GET /plans (public)
plansRouter.get(
  "/",
  wrap(async (req, res) => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true, ...platformWhere(req) },
      orderBy: { displayOrder: "asc" },
    });
    res.json({
      items: plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceInPaise: p.priceInPaise,
        compareAtPriceInPaise: p.compareAtPriceInPaise,
        currency: p.currency,
        durationDays: p.durationDays,
        description: p.description,
        features: p.features,
        isRecommended: p.isRecommended,
        displayOrder: p.displayOrder,
      })),
    });
  }),
);

export const subscriptionsRouter = Router();
subscriptionsRouter.use(requireAuth);

// GET /subscriptions/me
subscriptionsRouter.get(
  "/me",
  wrap(async (req, res) => {
    res.json(await getEntitlement(req.userId!));
  }),
);

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

// POST /payments/create-order — LOCAL SANDBOX. Creates a pending order + subscription.
paymentsRouter.post(
  "/create-order",
  wrap(async (req, res) => {
    const { planId } = z.object({ planId: z.string() }).parse(req.body);
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw notFound("Plan not found");

    const orderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    const order = await payments.createOrder({
      orderId,
      amount: plan.priceInPaise,
      currency: plan.currency,
    });

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId: req.userId!,
          planId: plan.id,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          status: "CREATED",
        },
      }),
      prisma.subscription.create({
        data: { userId: req.userId!, planId: plan.id, status: "PENDING" },
      }),
    ]);

    res.status(201).json({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      provider: payments.name,
      note: "LOCAL SANDBOX — no real payment. Send { orderId, sandboxApprove: true } to /payments/verify.",
    });
  }),
);

// POST /payments/verify — server-side verification, idempotent.
paymentsRouter.post(
  "/verify",
  wrap(async (req, res) => {
    const body = z
      .object({ orderId: z.string(), sandboxApprove: z.boolean().optional() })
      .parse(req.body);

    const payment = await prisma.payment.findUnique({
      where: { orderId: body.orderId },
    });
    if (!payment || payment.userId !== req.userId!)
      throw notFound("Order not found");

    // Idempotency: already-successful order just re-returns success.
    if (payment.status === "SUCCESS") {
      return res.json({ ok: true, alreadyProcessed: true });
    }

    const verified = await payments.verify({
      orderId: body.orderId,
      sandboxApprove: body.sandboxApprove,
    });
    if (!verified) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      throw badRequest("Payment verification failed");
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: payment.planId },
    });
    if (!plan) throw notFound("Plan not found");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.durationDays * 864e5);

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          paymentId: `pay_${crypto.randomBytes(8).toString("hex")}`,
          gatewayMeta: { provider: payments.name, verifiedAt: now.toISOString() },
        },
      }),
      // Expire any prior active subs, then activate the pending one.
      prisma.subscription.updateMany({
        where: { userId: req.userId!, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      }),
      prisma.subscription.updateMany({
        where: { userId: req.userId!, planId: plan.id, status: "PENDING" },
        data: { status: "ACTIVE", startedAt: now, expiresAt },
      }),
    ]);

    res.json({ ok: true, expiresAt });
  }),
);

// ================= GUEST CHECKOUT (no OTP) =================
// A brand-new customer subscribes without logging in first: they give a mobile
// number + plan, pay, and the account is created + logged in as part of checkout.
// (OTP stays only for the existing-user Login flow.) In production the real
// payment gateway verifies the payment + captures the phone, so identity is proven
// by the successful payment rather than an OTP.
export const guestRouter = Router();

const mobileSchema = z
  .string()
  .regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid Indian mobile number");

// POST /payments/guest/create-order
guestRouter.post(
  "/guest/create-order",
  authLimiter,
  wrap(async (req, res) => {
    const { mobile, planId } = z
      .object({ mobile: mobileSchema, planId: z.string() })
      .parse(req.body);
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true, ...platformWhere(req) },
    });
    if (!plan) throw notFound("Plan not found");

    // Find or create the user (+ a default profile on first purchase).
    let user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) {
      user = await prisma.user.create({
        data: { mobile, profiles: { create: [{ name: "Me" }] } },
      });
    }

    const orderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    const order = await payments.createOrder({
      orderId,
      amount: plan.priceInPaise,
      currency: plan.currency,
    });
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId: user.id,
          planId: plan.id,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          status: "CREATED",
        },
      }),
      prisma.subscription.create({
        data: { userId: user.id, planId: plan.id, status: "PENDING" },
      }),
    ]);

    res.status(201).json({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      provider: payments.name,
      note: "LOCAL SANDBOX — send { orderId, sandboxApprove: true } to /payments/guest/verify.",
    });
  }),
);

// POST /payments/guest/verify — verifies, activates, and logs the customer in.
guestRouter.post(
  "/guest/verify",
  authLimiter,
  wrap(async (req, res) => {
    const body = z
      .object({ orderId: z.string(), sandboxApprove: z.boolean().optional() })
      .parse(req.body);

    const payment = await prisma.payment.findUnique({ where: { orderId: body.orderId } });
    if (!payment) throw notFound("Order not found");

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: payment.planId } });
    const user = await prisma.user.findUnique({
      where: { id: payment.userId },
      include: { profiles: true },
    });
    if (!plan || !user) throw notFound("Order not found");

    if (payment.status !== "SUCCESS") {
      const verified = await payments.verify({
        orderId: body.orderId,
        sandboxApprove: body.sandboxApprove,
      });
      if (!verified) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        throw badRequest("Payment verification failed");
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.durationDays * 864e5);
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCESS",
            paymentId: `pay_${crypto.randomBytes(8).toString("hex")}`,
            gatewayMeta: { provider: payments.name, verifiedAt: now.toISOString(), guest: true },
          },
        }),
        prisma.subscription.updateMany({
          where: { userId: user.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        }),
        prisma.subscription.updateMany({
          where: { userId: user.id, planId: plan.id, status: "PENDING" },
          data: { status: "ACTIVE", startedAt: now, expiresAt },
        }),
      ]);
    }

    // Log the customer in (issue tokens) so they land straight in the app.
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
