"use server";

/**
 * Guardian media consent per child per scope (flag FEATURES.media). One MediaConsent row per grant;
 * withdrawing sets withdrawnAt on the active row and takes effect on the next view (no caching). A new
 * grant after a withdrawal is a new row, so the history stays.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  isMediaScope,
  MEDIA_IN_APP_CONSENT_METHOD,
  MEDIA_NOTICE_VERSION,
  MEDIA_SCOPES,
  type MediaScope,
} from "@/lib/media/constants";
import { guardianStudentIds, mediaEnabled, writeMediaAudit } from "@/lib/media/server";

type Fail = { ok: false; error: string };
const OFF: Fail = { ok: false, error: "Photos are not switched on yet." };

export type ChildMediaConsent = {
  studentId: string;
  name: string;
  orgName: string | null;
  scopes: Record<MediaScope, boolean>;
};

export async function getMyChildrenMediaConsents(): Promise<{ ok: true; children: ChildMediaConsent[]; noticeVersion: string } | Fail> {
  if (!mediaEnabled()) return OFF;
  const session = await requireAuth();
  const ids = await guardianStudentIds(session.id);
  if (!ids.length) return { ok: true, children: [], noticeVersion: MEDIA_NOTICE_VERSION };
  const [students, consents] = await Promise.all([
    db.student.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, orgId: true, org: { select: { name: true } } }, orderBy: { name: "asc" } }),
    db.mediaConsent.findMany({ where: { studentId: { in: ids }, withdrawnAt: null }, select: { studentId: true, orgId: true, scope: true } }),
  ]);
  return {
    ok: true,
    noticeVersion: MEDIA_NOTICE_VERSION,
    children: students.map((s) => {
      const scopes = Object.fromEntries(MEDIA_SCOPES.map((sc) => [sc, false])) as Record<MediaScope, boolean>;
      for (const c of consents) if (c.studentId === s.id && c.orgId === s.orgId && isMediaScope(c.scope)) scopes[c.scope] = true;
      return { studentId: s.id, name: s.name, orgName: s.org?.name ?? null, scopes };
    }),
  };
}

async function guardianChild(userId: string, studentId: string) {
  const ids = await guardianStudentIds(userId);
  if (!ids.includes(studentId)) return null;
  const s = await db.student.findUnique({ where: { id: studentId }, select: { id: true, orgId: true } });
  return s?.orgId ? { id: s.id, orgId: s.orgId } : null;
}

/** Grants or withdraws one scope for one child. Only that child's guardian can do this. */
export async function setMediaConsent(studentId: string, scope: string, granted: boolean): Promise<{ ok: true } | Fail> {
  if (!mediaEnabled()) return OFF;
  const session = await requireAuth();
  if (!isMediaScope(scope)) return { ok: false, error: "Unknown consent option." };
  const child = await guardianChild(session.id, String(studentId));
  if (!child) return { ok: false, error: "Only this child's guardian can change photo consent." };

  const now = new Date();
  await db.$transaction(async (tx) => {
    const active = await tx.mediaConsent.findMany({
      where: { studentId: child.id, orgId: child.orgId, scope, withdrawnAt: null },
      select: { id: true },
    });
    if (granted) {
      if (active.length) return; // already granted
      await tx.mediaConsent.create({
        data: {
          orgId: child.orgId,
          studentId: child.id,
          guardianUserId: session.id,
          scope,
          grantedAt: now,
          verificationMethod: MEDIA_IN_APP_CONSENT_METHOD,
          noticeVersion: MEDIA_NOTICE_VERSION,
        },
      });
      await writeMediaAudit(tx, {
        orgId: child.orgId,
        actorUserId: session.id,
        action: "CONSENT_GRANT",
        details: { studentId: child.id, scope, noticeVersion: MEDIA_NOTICE_VERSION },
      });
    } else {
      if (!active.length) return;
      await tx.mediaConsent.updateMany({ where: { id: { in: active.map((a) => a.id) } }, data: { withdrawnAt: now } });
      await writeMediaAudit(tx, { orgId: child.orgId, actorUserId: session.id, action: "CONSENT_WITHDRAW", details: { studentId: child.id, scope } });
    }
  });
  revalidatePath("/gallery");
  revalidatePath("/gallery/consent");
  return { ok: true };
}

/** Withdraws every media scope for a child at once. */
export async function withdrawAllMediaConsent(studentId: string): Promise<{ ok: true; withdrawn: number } | Fail> {
  if (!mediaEnabled()) return OFF;
  const session = await requireAuth();
  const child = await guardianChild(session.id, String(studentId));
  if (!child) return { ok: false, error: "Only this child's guardian can change photo consent." };
  const now = new Date();
  const withdrawn = await db.$transaction(async (tx) => {
    const active = await tx.mediaConsent.findMany({
      where: { studentId: child.id, orgId: child.orgId, withdrawnAt: null },
      select: { id: true, scope: true },
    });
    if (!active.length) return 0;
    await tx.mediaConsent.updateMany({ where: { id: { in: active.map((a) => a.id) } }, data: { withdrawnAt: now } });
    await writeMediaAudit(tx, {
      orgId: child.orgId,
      actorUserId: session.id,
      action: "CONSENT_WITHDRAW",
      details: { studentId: child.id, scopes: [...new Set(active.map((a) => a.scope))], all: true },
    });
    return active.length;
  });
  revalidatePath("/gallery");
  revalidatePath("/gallery/consent");
  return { ok: true, withdrawn };
}
