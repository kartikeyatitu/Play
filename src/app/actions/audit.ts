"use server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkPermission, requirePermission } from "@/lib/membership";
import type { Prisma } from "@prisma/client";
import { FEATURES } from "@/lib/features";
import {
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_LOG_VIEWER_DISABLED_ERROR,
  AUDIT_PAGE_SIZE,
  auditRowsToCsv,
  clampPageSize,
  parseAuditFilter,
  parseDetails,
  type AuditFilter,
} from "@/lib/audit-csv";

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

function auditWhere(orgId: string, f: AuditFilter): Prisma.AuditLogWhereInput {
  return {
    orgId,
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
  };
}

/**
 * Owner-only audit-log viewer (flag `auditLogViewer`): newest first, filter by action prefix and date range,
 * cursor-paged by row id.
 */
export async function listAuditLog(input: { action?: string; from?: string; to?: string; cursor?: string | null; pageSize?: number }) {
  if (!FEATURES.auditLogViewer) return { success: false as const, error: AUDIT_LOG_VIEWER_DISABLED_ERROR };
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const parsed = parseAuditFilter(input);
  if (!parsed.ok) return { success: false as const, error: parsed.error };
  const take = clampPageSize(input?.pageSize ?? AUDIT_PAGE_SIZE);
  const where = auditWhere(auth.session.orgId, parsed.filter);

  // The cursor must belong to this org; otherwise start from the top.
  const cursor = typeof input?.cursor === "string" && input.cursor
    ? await db.auditLog.findFirst({ where: { id: input.cursor, orgId: auth.session.orgId }, select: { id: true } })
    : null;

  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    select: { id: true, action: true, details: true, createdAt: true, user: { select: { name: true, role: true } } },
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return {
    success: true as const,
    rows: page.map((r) => ({
      id: r.id,
      action: r.action,
      createdAt: r.createdAt.toISOString(),
      userName: r.user?.name ?? null,
      userRole: r.user?.role ?? null,
      details: parseDetails(r.details),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/** Owner-only CSV export of the filtered audit log (max AUDIT_EXPORT_MAX_ROWS rows). The export itself is audited. */
export async function exportAuditLogCsv(input: { action?: string; from?: string; to?: string }) {
  if (!FEATURES.auditLogViewer) return { success: false as const, error: AUDIT_LOG_VIEWER_DISABLED_ERROR };
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const parsed = parseAuditFilter(input);
  if (!parsed.ok) return { success: false as const, error: parsed.error };
  const { session } = auth;

  const rows = await db.auditLog.findMany({
    where: auditWhere(session.orgId, parsed.filter),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_EXPORT_MAX_ROWS + 1,
    select: { action: true, details: true, createdAt: true, user: { select: { name: true, role: true } } },
  });
  const truncated = rows.length > AUDIT_EXPORT_MAX_ROWS;
  const out = truncated ? rows.slice(0, AUDIT_EXPORT_MAX_ROWS) : rows;
  const csv = auditRowsToCsv(out.map((r) => ({ createdAt: r.createdAt, action: r.action, userName: r.user?.name ?? null, userRole: r.user?.role ?? null, details: r.details })));

  await db.auditLog
    .create({
      data: {
        userId: session.id,
        orgId: session.orgId,
        action: "AUDIT_LOG_EXPORTED",
        details: JSON.stringify({ rows: out.length, truncated, action: parsed.filter.action, from: input?.from ?? null, to: input?.to ?? null }),
      },
    })
    .catch(() => {});

  const stamp = new Date().toISOString().slice(0, 10);
  return { success: true as const, csv, filename: `audit-log-${stamp}.csv`, count: out.length, truncated };
}
