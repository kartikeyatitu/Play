"use server";

// V7 TRIQ Creators server actions. Async exports only. Re-checks FEATURES.creators everywhere.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { safeHttpUrl } from "@/lib/safe-url";
import { rateLimitDb } from "@/lib/rate-limit";
import { MAX_PORTFOLIO_ITEMS, isProfileVisible, validateCreatorProfile, validatePortfolioItem, validateReport } from "@/lib/creators";

const ME = "/creators/me";

function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function back(path: string, error?: string, ok = "saved=1"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}error=${encodeURIComponent(error)}` : `${path}${sep}${ok}`);
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

async function signedIn() {
  if (!FEATURES.creators) redirect("/");
  return requireAuth();
}

async function audit(userId: string, orgId: string | null, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
}

export async function saveCreatorProfile(formData: FormData): Promise<void> {
  const session = await signedIn();
  const parsed = validateCreatorProfile(fields(formData), formData.getAll("categories"));
  if (!parsed.ok) back(ME, parsed.error);
  const v = parsed.value;

  // Only link pages the creator genuinely belongs to.
  if (v.linkedOrgId) {
    // Direct lookup (no legacy backfill side effects on another org); legacy users match on User.orgId.
    const [membership, legacy] = await Promise.all([
      db.orgMembership.findFirst({ where: { userId: session.id, orgId: v.linkedOrgId, status: "ACTIVE" }, select: { id: true } }),
      db.user.findFirst({ where: { id: session.id, orgId: v.linkedOrgId, role: { in: ["ADMIN", "COACH", "STAFF"] }, memberships: { none: { orgId: v.linkedOrgId } } }, select: { id: true } }),
    ]);
    if (!membership && !legacy) back(ME, "You can only link an academy or venue you are an active member of");
  }
  const linkCoachPage = v.linkCoachPage && (session.role === "COACH" || session.role === "ADMIN");

  const taken = await db.creatorProfile.findUnique({ where: { handle: v.handle }, select: { userId: true } });
  if (taken && taken.userId !== session.id) back(ME, "That handle is taken");

  const data = { ...v, linkCoachPage };
  try {
    await db.creatorProfile.upsert({ where: { userId: session.id }, create: { userId: session.id, ...data }, update: data });
  } catch (e: any) {
    if (e?.code === "P2002") back(ME, "That handle is taken");
    throw e;
  }
  await audit(session.id, session.orgId, "CREATOR_PROFILE_SAVED", { handle: v.handle, isPublic: v.isPublic, linkedOrgId: v.linkedOrgId });
  revalidatePath(ME);
  revalidatePath("/creators");
  back(ME);
}

export async function addPortfolioItem(formData: FormData): Promise<void> {
  const session = await signedIn();
  const profile = await db.creatorProfile.findUnique({ where: { userId: session.id }, select: { id: true } });
  if (!profile) back(ME, "Create your creator profile first");
  const parsed = validatePortfolioItem(fields(formData), safeHttpUrl);
  if (!parsed.ok) back(ME, parsed.error);
  const count = await db.creatorPortfolioItem.count({ where: { creatorId: profile.id } });
  if (count >= MAX_PORTFOLIO_ITEMS) back(ME, `You can add up to ${MAX_PORTFOLIO_ITEMS} links`);
  const item = await db.creatorPortfolioItem.create({ data: { creatorId: profile.id, ...parsed.value } });
  await audit(session.id, session.orgId, "CREATOR_ITEM_ADDED", { itemId: item.id, platform: item.platform });
  revalidatePath(ME);
  back(ME);
}

export async function removePortfolioItem(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  if (!validId(id)) back(ME, "Not found");
  const profile = await db.creatorProfile.findUnique({ where: { userId: session.id }, select: { id: true } });
  if (!profile) back(ME, "Not found");
  const { count } = await db.creatorPortfolioItem.deleteMany({ where: { id, creatorId: profile.id } });
  if (count) await audit(session.id, session.orgId, "CREATOR_ITEM_REMOVED", { itemId: id });
  revalidatePath(ME);
  back(ME);
}

export async function reportContent(formData: FormData): Promise<void> {
  const session = await signedIn();
  const handle = String(formData.get("handle") || "").replace(/[^a-z0-9_]/g, "").slice(0, 30);
  const path = handle ? `/creators/${handle}` : "/creators";
  const parsed = validateReport(fields(formData));
  if (!parsed.ok) back(path, parsed.error);
  const { targetType, targetId, reason, details } = parsed.value;

  const limit = await rateLimitDb(`creator-report:${session.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) back(path, "Too many reports in the last hour. Try again later.");

  // Resolve the target to its creator; only publicly visible content can be reported.
  let creator: { id: string; userId: string; isPublic: boolean; hiddenAt: Date | null } | null = null;
  if (targetType === "CREATOR_PROFILE") {
    creator = await db.creatorProfile.findUnique({ where: { id: targetId }, select: { id: true, userId: true, isPublic: true, hiddenAt: true } });
  } else {
    const item = await db.creatorPortfolioItem.findFirst({ where: { id: targetId, hiddenAt: null }, select: { creatorId: true } });
    if (item) {
      creator = await db.creatorProfile.findUnique({ where: { id: item.creatorId }, select: { id: true, userId: true, isPublic: true, hiddenAt: true } });
    }
  }
  if (!creator || !isProfileVisible(creator)) back(path, "Content not found");
  if (creator.userId === session.id) back(path, "You cannot report your own content");

  try {
    const report = await db.contentReport.create({
      data: { targetType, targetId, creatorId: creator.id, reporterId: session.id, reason, details },
    });
    await audit(session.id, session.orgId, "CONTENT_REPORTED", { reportId: report.id, targetType, targetId, reason });
  } catch (e: any) {
    if (e?.code === "P2002") back(path, "You have already reported this");
    throw e;
  }
  back(path, undefined, "reported=1");
}
