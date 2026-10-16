"use server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/membership";

export async function logAction(_userId: string, action: string, details?: Record<string, any>) {
    const session = await requireAuth(['ADMIN']);
  await db.auditLog.create({
    data: {
      userId: session.id, // never trust a client-supplied userId
      orgId: session.orgId || null,
      action,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

export async function getAuditLog(limit: number = 50) {
  const { session } = await requirePermission("reports.view");
  const take = Math.min(Math.max(1, Number(limit) || 50), 500);
  return db.auditLog.findMany({
    where: { orgId: session.orgId },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
