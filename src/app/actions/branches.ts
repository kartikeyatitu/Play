"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";
import { parseBranchInput, BRANCHES_DISABLED_ERROR, MAX_BRANCHES } from "@/lib/branch-input";
import { FEATURES } from "@/lib/features";

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  try {
    await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
  } catch (err) {
    console.error(`[branches] audit ${action} failed`, err);
  }
}

/** Branches of the caller's academy, with how many batches run at each. */
export async function listBranches() {
  // Flag off: never touch the Branch table (it may not exist in production yet).
  if (!FEATURES.branches) return { success: false as const, error: BRANCHES_DISABLED_ERROR, branches: [] };
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false as const, error: auth.error, branches: [] };
  const branches = await db.branch.findMany({
    where: { orgId: auth.session.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true, city: true, _count: { select: { batches: true } } },
  });
  return {
    success: true as const,
    branches: branches.map((b) => ({ id: b.id, name: b.name, address: b.address, city: b.city, batchCount: b._count.batches })),
  };
}

export async function createBranch(formData: FormData) {
  if (!FEATURES.branches) return { success: false, error: BRANCHES_DISABLED_ERROR };
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;

  const parsed = parseBranchInput({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
  });
  if (!parsed.ok) return { success: false, error: parsed.error };

  const count = await db.branch.count({ where: { orgId: session.orgId } });
  if (count >= MAX_BRANCHES) return { success: false, error: `An academy can have at most ${MAX_BRANCHES} branches.` };

  const clash = await db.branch.findUnique({
    where: { orgId_name: { orgId: session.orgId, name: parsed.data.name } },
    select: { id: true },
  });
  if (clash) return { success: false, error: "A branch with this name already exists." };

  const branch = await db.branch.create({ data: { orgId: session.orgId, ...parsed.data } });
  await audit(session.id, session.orgId, "BRANCH_CREATED", { branchId: branch.id, name: branch.name });
  revalidatePath("/org");
  return { success: true, branchId: branch.id };
}

export async function updateBranch(branchId: string, formData: FormData) {
  if (!FEATURES.branches) return { success: false, error: BRANCHES_DISABLED_ERROR };
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;

  const existing = await db.branch.findFirst({ where: { id: branchId, orgId: session.orgId }, select: { id: true, name: true } });
  if (!existing) return { success: false, error: "Branch not found in your academy." };

  const parsed = parseBranchInput({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
  });
  if (!parsed.ok) return { success: false, error: parsed.error };

  if (parsed.data.name !== existing.name) {
    const clash = await db.branch.findUnique({
      where: { orgId_name: { orgId: session.orgId, name: parsed.data.name } },
      select: { id: true },
    });
    if (clash) return { success: false, error: "A branch with this name already exists." };
  }

  await db.branch.update({ where: { id: existing.id }, data: parsed.data });
  await audit(session.id, session.orgId, "BRANCH_UPDATED", { branchId, from: existing.name, to: parsed.data.name });
  revalidatePath("/org");
  return { success: true };
}

/** Deleting a branch keeps its batches; they simply become unassigned (ON DELETE SET NULL). */
export async function deleteBranch(branchId: string) {
  if (!FEATURES.branches) return { success: false, error: BRANCHES_DISABLED_ERROR };
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;

  const existing = await db.branch.findFirst({
    where: { id: branchId, orgId: session.orgId },
    select: { id: true, name: true, _count: { select: { batches: true } } },
  });
  if (!existing) return { success: false, error: "Branch not found in your academy." };

  await db.branch.delete({ where: { id: existing.id } });
  await audit(session.id, session.orgId, "BRANCH_DELETED", {
    branchId,
    name: existing.name,
    batchesUnassigned: existing._count.batches,
  });
  revalidatePath("/org");
  return { success: true, batchesUnassigned: existing._count.batches };
}
