"use server";

// Internal ops inbox actions. SUPER_ADMIN only.
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

const SALES_STATUSES = ["NEW", "CONTACTED", "DEMO", "TRIAL", "WON", "LOST"] as const;
const CLAIM_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const DIRECTORY_LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "SPAM"] as const;

function pick(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function validId(id: string) {
  return id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function updateSalesLeadStatus(formData: FormData): Promise<void> {
  await requireAuth(["SUPER_ADMIN"]);
  const id = pick(formData, "id");
  const status = pick(formData, "status");
  if (!validId(id) || !(SALES_STATUSES as readonly string[]).includes(status)) return;
  await db.salesLead.update({ where: { id }, data: { status } });
  revalidatePath("/ops/leads");
}

export async function updateDirectoryLeadStatus(formData: FormData): Promise<void> {
  await requireAuth(["SUPER_ADMIN"]);
  const id = pick(formData, "id");
  const status = pick(formData, "status");
  if (!validId(id) || !(DIRECTORY_LEAD_STATUSES as readonly string[]).includes(status)) return;
  await db.directoryLead.update({ where: { id }, data: { status } });
  revalidatePath("/ops/leads");
}

export async function updateClaimStatus(formData: FormData): Promise<void> {
  await requireAuth(["SUPER_ADMIN"]);
  const id = pick(formData, "id");
  const status = pick(formData, "status");
  if (!validId(id) || !(CLAIM_STATUSES as readonly string[]).includes(status)) return;

  const claim = await db.claimRequest.update({
    where: { id },
    data: { status },
    select: { listedAcademyId: true },
  });

  if (status === "APPROVED") {
    // Verified owner. claimedOrgId is linked separately once their Triq org exists.
    await db.listedAcademy.update({ where: { id: claim.listedAcademyId }, data: { claimStatus: "CLAIMED" } });
  } else {
    // If no claims remain pending/approved, the listing goes back to UNCLAIMED (never touch linked orgs).
    const open = await db.claimRequest.count({
      where: { listedAcademyId: claim.listedAcademyId, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (open === 0) {
      await db.listedAcademy.updateMany({
        where: { id: claim.listedAcademyId, claimedOrgId: null },
        data: { claimStatus: "UNCLAIMED" },
      });
    } else if (status === "PENDING") {
      await db.listedAcademy.updateMany({
        where: { id: claim.listedAcademyId, claimStatus: "UNCLAIMED" },
        data: { claimStatus: "PENDING" },
      });
    }
  }
  revalidatePath("/ops/leads");
}
