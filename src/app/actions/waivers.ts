"use server";

// Versioned liability waivers and guardian e-signatures (flag FEATURES.waivers).
// Exports only async functions.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";
import { rateLimitDb } from "@/lib/rate-limit";
import { guardianStudent } from "@/lib/family/guardians";
import { checkSignatureInput, hashSignerIp, nextWaiverVersion } from "@/lib/consent/waivers";

const ORG_PAGE = "/org/waivers";
const OFF_ERROR = "Waivers are not switched on yet.";

function back(path: string, error?: string, extra?: Record<string, string>): never {
  const qs = new URLSearchParams(extra);
  if (error) qs.set("error", error.slice(0, 200));
  else qs.set("saved", "1");
  redirect(`${path}?${qs.toString()}`);
}

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim() || null;
  } catch {
    return null;
  }
}

async function audit(userId: string, orgId: string | null, action: string, details: Record<string, unknown>) {
  try {
    await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
  } catch {
    // never block on audit logging
  }
}

/**
 * Owner only (settings.manage is owner-only). Publishes waiver text. Reusing an existing title creates
 * the next version and retires the previous one, so every child must be signed again.
 * COUNSEL: the waiver text itself, and whether a liability waiver signed for a minor is enforceable
 * under the Indian Contract Act 1872 (a minor cannot contract; a guardian signing on their behalf
 * may not bind them). Treat the signature as acknowledgement of risk, not a guaranteed release.
 */
export async function publishWaiverTemplate(formData: FormData): Promise<void> {
  if (!FEATURES.waivers) back(ORG_PAGE, OFF_ERROR);
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) back(ORG_PAGE, auth.error);
  const { session } = auth;
  const title = String(formData.get("title") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 20_000);
  if (title.length < 3) back(ORG_PAGE, "Give the waiver a title.");
  if (body.length < 20) back(ORG_PAGE, "Write the waiver text (at least a sentence).");

  const existing = await db.waiverTemplate.findMany({ where: { orgId: session.orgId, title }, select: { id: true, title: true, version: true, body: true, active: true } });
  const current = existing.find((t) => t.active);
  if (current && current.body === body) back(ORG_PAGE, "Nothing changed: the text is the same as the current version.");
  const version = nextWaiverVersion(existing, title);

  const created = await db.$transaction(async (tx) => {
    await tx.waiverTemplate.updateMany({ where: { orgId: session.orgId, title, active: true }, data: { active: false } });
    return tx.waiverTemplate.create({ data: { orgId: session.orgId, title, body, version, active: true, createdById: session.id } });
  });
  await audit(session.id, session.orgId, "WAIVER_PUBLISHED", { templateId: created.id, title, version });
  revalidatePath(ORG_PAGE);
  back(ORG_PAGE, undefined, { template: created.id });
}

/** Owner only: stop asking for a waiver. Signatures are kept. */
export async function retireWaiverTemplate(formData: FormData): Promise<void> {
  if (!FEATURES.waivers) back(ORG_PAGE, OFF_ERROR);
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) back(ORG_PAGE, auth.error);
  const id = String(formData.get("templateId") ?? "");
  const { count } = await db.waiverTemplate.updateMany({ where: { id, orgId: auth.session.orgId, active: true }, data: { active: false } });
  if (!count) back(ORG_PAGE, "Waiver not found.");
  await audit(auth.session.id, auth.session.orgId, "WAIVER_RETIRED", { templateId: id });
  revalidatePath(ORG_PAGE);
  back(ORG_PAGE);
}

/**
 * A guardian signs the current version of a waiver for one child: typed full name, "I agree" checkbox,
 * server timestamp, and the IP stored only as sha256(orgId:ip). Signatures are append-only.
 */
export async function signWaiver(input: { templateId: string; studentId: string; signedName: string; agreed: boolean }): Promise<{ ok: true; alreadySigned?: boolean } | { ok: false; error: string }> {
  if (!FEATURES.waivers) return { ok: false, error: OFF_ERROR };
  const session = await getSession();
  if (!session?.id) return { ok: false, error: "Please sign in again." };
  const rl = await rateLimitDb(`waiver-sign:${session.id}`, 30, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const check = checkSignatureInput(input);
  if (!check.ok) return check;

  const student = await guardianStudent(session.id, String(input.studentId ?? ""));
  if (!student || !student.orgId) return { ok: false, error: "You are not listed as a guardian of this child." };

  const template = await db.waiverTemplate.findFirst({
    where: { id: String(input.templateId ?? ""), orgId: student.orgId, active: true },
    select: { id: true, version: true, title: true },
  });
  if (!template) return { ok: false, error: "This waiver has been updated. Reload the page to sign the latest version." };

  const done = await db.waiverSignature.findUnique({
    where: { templateId_version_studentId: { templateId: template.id, version: template.version, studentId: student.id } },
    select: { id: true },
  });
  if (done) return { ok: true, alreadySigned: true };

  try {
    await db.waiverSignature.create({
      data: {
        orgId: student.orgId,
        templateId: template.id,
        version: template.version,
        studentId: student.id,
        guardianUserId: session.id,
        signedName: check.signedName,
        ipHash: hashSignerIp(await clientIp(), student.orgId),
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { ok: true, alreadySigned: true }; // the other guardian signed first
    throw e;
  }
  await audit(session.id, student.orgId, "WAIVER_SIGNED", { templateId: template.id, version: template.version, studentId: student.id });
  revalidatePath("/family/waivers");
  return { ok: true };
}
