import { prisma } from "../../lib/prisma.js";

export interface Entitlement {
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING" | "FAILED";
  planName?: string | null;
  expiresAt?: Date | null;
  isActive: boolean;
}

// Single source of truth for "is this user premium right now".
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    include: { plan: true },
  });
  if (sub) {
    return {
      status: "ACTIVE",
      planName: sub.plan.name,
      expiresAt: sub.expiresAt,
      isActive: true,
    };
  }
  // Reflect the most recent non-active subscription state, if any.
  const last = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  return {
    status: last?.status ?? "EXPIRED",
    planName: last?.plan.name ?? null,
    expiresAt: last?.expiresAt ?? null,
    isActive: false,
  };
}
