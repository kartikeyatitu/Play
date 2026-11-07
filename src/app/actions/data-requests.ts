"use server";

// Data requests (DataRequest, flag FEATURES.dataRequests). The queue records decisions only:
// nothing here deletes any data. Exports only async functions.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getSession } from "@/lib/auth";
import { isOrgOwner } from "@/lib/membership";
import { rateLimitDb } from "@/lib/rate-limit";
import { guardianStudent } from "@/lib/family/guardians";
import { canMoveDataRequest, exportDownloadOpen, isFinalStatus, makeReferenceId } from "@/lib/consent/data-requests";
import { recordDataRequestEvent, studentIdsForRequests } from "@/lib/consent/data-requests-server";
import { buildChildExport } from "@/lib/consent/data-export";

const OFF_ERROR = "Data requests are not switched on yet.";
const QUEUE = "/org/data-requests";

/** A guardian asks for a copy of their child's data. Reviewed by the academy owner or TRIQ ops. */
export async function requestChildExport(studentId: string): Promise<{ ok: true; referenceId: string } | { ok: false; error: string }> {
  if (!FEATURES.dataRequests) return { ok: false, error: OFF_ERROR };
  const session = await getSession();
  if (!session?.id) return { ok: false, error: "Please sign in again." };
  const rl = await rateLimitDb(`data-export:${session.id}`, 5, 24 * 60 * 60_000);
  if (!rl.allowed) return { ok: false, error: "You have made several requests today. Please wait for those to be reviewed." };

  const student = await guardianStudent(session.id, String(studentId ?? ""));
  if (!student) return { ok: false, error: "You are not listed as a guardian of this child." };
  const user = await db.user.findUnique({ where: { id: session.id }, select: { phone: true } });

  const referenceId = makeReferenceId();
  const firstName = student.name.trim().split(/\s+/)[0] || "child";
  await db.dataRequest.create({
    data: { orgId: student.orgId, userId: session.id, phone: user?.phone ?? null, type: "EXPORT", reason: `Copy of ${firstName}'s data`, referenceId },
  });
  await recordDataRequestEvent(session.id, student.orgId, { event: "CREATED", referenceId, type: "EXPORT", studentId: student.id });
  revalidatePath("/family");
  return { ok: true, referenceId };
}

/**
 * Owner (their academy's requests) or TRIQ ops (SUPER_ADMIN, every request) moves a request through
 * REQUESTED -> IN_REVIEW -> DONE | REJECTED. Every move is written to AuditLog with the note.
 * COUNSEL: who may decide a DELETE request (academy owner as data fiduciary, or TRIQ as processor),
 * what must be retained (financial records), and the response deadline.
 */
export async function updateDataRequestStatus(formData: FormData): Promise<void> {
  const fail = (msg: string): never => redirect(`${QUEUE}?error=${encodeURIComponent(msg)}`);
  if (!FEATURES.dataRequests) fail(OFF_ERROR);
  const session = await getSession();
  if (!session?.id) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || undefined;

  const req = await db.dataRequest.findUnique({ where: { id } });
  if (!req) fail("Request not found.");
  const r = req!;
  const isOps = session.role === "SUPER_ADMIN";
  const me = await db.user.findUnique({ where: { id: session.id }, select: { orgId: true } });
  const ownsIt = !isOps && session.role === "ADMIN" && !!r.orgId && r.orgId === me?.orgId && (await isOrgOwner(session.id, r.orgId));
  if (!isOps && !ownsIt) fail("Only the academy owner or TRIQ support can review this request.");
  if (!canMoveDataRequest(r.status, to)) fail("That status change is not allowed.");
  if (to === "REJECTED" && !note) fail("Add a note explaining why the request is rejected.");

  const final = isFinalStatus(to);
  const { count } = await db.dataRequest.updateMany({
    where: { id: r.id, status: r.status },
    data: { status: to, ...(final ? { resolvedAt: new Date(), resolvedById: session.id } : {}) },
  });
  if (!count) fail("The request changed meanwhile. Refresh and try again.");
  await recordDataRequestEvent(session.id, r.orgId, { event: "STATUS", referenceId: r.referenceId, type: r.type, from: r.status, to, note });
  revalidatePath(QUEUE);
  redirect(`${QUEUE}?saved=1`);
}

/**
 * The requesting guardian downloads an approved EXPORT (status DONE) within the download window.
 * Returns the JSON text; the browser saves it. Each download is audited.
 */
export async function downloadChildExport(referenceId: string): Promise<{ ok: true; filename: string; json: string } | { ok: false; error: string }> {
  if (!FEATURES.dataRequests) return { ok: false, error: OFF_ERROR };
  const session = await getSession();
  if (!session?.id) return { ok: false, error: "Please sign in again." };
  const req = await db.dataRequest.findUnique({ where: { referenceId: String(referenceId ?? "") } });
  if (!req || req.userId !== session.id || req.type !== "EXPORT") return { ok: false, error: "Request not found." };
  if (!exportDownloadOpen(req)) {
    return { ok: false, error: req.status === "DONE" ? "This download has expired. Please make a new request." : "This request has not been approved yet." };
  }
  const studentId = (await studentIdsForRequests([req.referenceId])).get(req.referenceId);
  // Re-check guardianship at download time (a guardian link may have been removed since).
  const student = studentId ? await guardianStudent(session.id, studentId) : null;
  if (!student) return { ok: false, error: "You are no longer listed as a guardian of this child." };

  const data = await buildChildExport(student.id, { userId: session.id, referenceId: req.referenceId });
  if (!data) return { ok: false, error: "Child record not found." };
  await recordDataRequestEvent(session.id, req.orgId, { event: "DOWNLOADED", referenceId: req.referenceId });
  const safe = student.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "child";
  return { ok: true, filename: `triq-${safe}-${req.referenceId}.json`, json: JSON.stringify(data, null, 2) };
}
