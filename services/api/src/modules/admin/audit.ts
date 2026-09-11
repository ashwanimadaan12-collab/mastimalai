import { prisma } from "../../lib/prisma.js";
import type { AdminClaims } from "./rbac.js";

// Append an audit-log entry (§95). Never throws into the request path.
export async function audit(
  admin: AdminClaims | undefined,
  input: {
    action: string;
    entity: string;
    entityId?: string | null;
    summary: string;
    changes?: unknown;
  },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: admin?.sub ?? null,
        adminName: admin?.name ?? "system",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        changes: (input.changes ?? undefined) as never,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed", e);
  }
}
