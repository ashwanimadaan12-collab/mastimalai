import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { badRequest, notFound, wrap } from "../../lib/http.js";
import { requireAuth } from "../../middleware/index.js";
import { getEntitlement } from "../billing/entitlement.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const profileBody = z.object({
  name: z.string().min(1).max(40),
  isKids: z.boolean().optional(),
  avatar: z.string().url().optional().nullable(),
  language: z.string().max(10).optional().nullable(),
});

// GET /users/me
usersRouter.get(
  "/me",
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { profiles: { orderBy: { createdAt: "asc" } } },
    });
    if (!user) throw notFound("User not found");
    const ent = await getEntitlement(user.id);
    res.json({
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
      subscription: {
        status: ent.status,
        planName: ent.planName,
        expiresAt: ent.expiresAt,
        isActive: ent.isActive,
      },
    });
  }),
);

// PATCH /users/me
usersRouter.patch(
  "/me",
  wrap(async (req, res) => {
    const { email } = z
      .object({ email: z.string().email().nullable().optional() })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { email: email ?? null },
    });
    res.json({ id: user.id, mobile: user.mobile, email: user.email });
  }),
);

export const profilesRouter = Router();
profilesRouter.use(requireAuth);

// GET /profiles
profilesRouter.get(
  "/",
  wrap(async (req, res) => {
    const profiles = await prisma.profile.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "asc" },
    });
    res.json({ items: profiles });
  }),
);

// POST /profiles
profilesRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = profileBody.parse(req.body);
    const count = await prisma.profile.count({ where: { userId: req.userId! } });
    if (count >= env.maxProfilesPerUser)
      throw badRequest(`Profile limit reached (max ${env.maxProfilesPerUser})`);
    const profile = await prisma.profile.create({
      data: { ...body, userId: req.userId! },
    });
    res.status(201).json(profile);
  }),
);

// PATCH /profiles/:id
profilesRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const body = profileBody.partial().parse(req.body);
    const existing = await prisma.profile.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw notFound("Profile not found");
    const profile = await prisma.profile.update({
      where: { id: existing.id },
      data: body,
    });
    res.json(profile);
  }),
);

// DELETE /profiles/:id
profilesRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const existing = await prisma.profile.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw notFound("Profile not found");
    const count = await prisma.profile.count({ where: { userId: req.userId! } });
    if (count <= 1) throw badRequest("Cannot delete the last profile");
    await prisma.profile.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
