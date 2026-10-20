"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";

// Tenant scope: the orgId argument is ignored (untrusted) — always use the session's org.
export async function getLeads(_orgId?: string) {
    const session = await requireAuth(['ADMIN']);
  try {
    const leads = await db.lead.findMany({
      where: { orgId: session.orgId || "__no_org__" },
      orderBy: { createdAt: "desc" },
    });
    return leads;
  } catch (error) {
    console.error("Error fetching leads:", error);
    return [];
  }
}

export async function createLead(data: {
  parentName: string;
  parentPhone: string;
  childName: string;
  childAge?: number;
  sport?: string;
  source: string;
  notes?: string;
  orgId?: string;
}) {
  const auth = await checkPermission("leads.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const lead = await db.lead.create({
      data: {
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        childName: data.childName,
        childAge: data.childAge,
        sport: data.sport,
        source: data.source,
        notes: data.notes,
        orgId: session.orgId, // never trust data.orgId
      },
    });
    revalidatePath("/org");
    return { success: true, lead };
  } catch (error) {
    console.error("Error creating lead:", error);
    return { success: false, error: "Failed to create lead" };
  }
}

// Lifecycle enums live in @/lib/enums (no Prisma deps) so tests can import them.
export { LEAD_STATUSES, type LeadStatus } from "@/lib/enums";
import { LEAD_STATUSES as _LEAD_STATUSES, type LeadStatus as _LeadStatus } from "@/lib/enums";

export async function updateLeadStatus(leadId: string, status: string) {
  const auth = await checkPermission("leads.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;

  if (!_LEAD_STATUSES.includes(status as _LeadStatus)) {
    return {
      success: false,
      error: `Invalid status "${status}". Allowed: ${_LEAD_STATUSES.join(", ")}`,
    };
  }

  try {
    const existing = await db.lead.findFirst({ where: { id: leadId, orgId: session.orgId } });
    if (!existing) return { success: false, error: "Lead not found" };
    const lead = await db.lead.update({
      where: { id: existing.id },
      data: { status },
    });
    revalidatePath("/org");
    return { success: true, lead };
  } catch (error) {
    console.error("Error updating lead status:", error);
    return { success: false, error: "Failed to update lead status" };
  }
}

export async function updateLead(leadId: string, data: { notes?: string; followUpDate?: Date }) {
  const auth = await checkPermission("leads.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const existing = await db.lead.findFirst({ where: { id: leadId, orgId: session.orgId } });
    if (!existing) return { success: false, error: "Lead not found" };
    // Only allow whitelisted fields (prevents e.g. moving a lead to another org via `orgId`)
    const lead = await db.lead.update({
      where: { id: existing.id },
      data: {
        ...(data?.notes !== undefined ? { notes: data.notes } : {}),
        ...(data?.followUpDate !== undefined ? { followUpDate: data.followUpDate } : {}),
      },
    });
    revalidatePath("/org");
    return { success: true, lead };
  } catch (error) {
    console.error("Error updating lead:", error);
    return { success: false, error: "Failed to update lead" };
  }
}

export async function getLeadStats(_orgId?: string) {
    const session = await requireAuth(['ADMIN']);
  try {
    const leads = await db.lead.findMany({
      where: { orgId: session.orgId || "__no_org__" },
      select: { status: true, source: true, createdAt: true, updatedAt: true },
    });

    const statusCounts = leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Conversion Analytics: Trial to Enrolled
    const trials = leads.filter(l => l.status === "TRIAL_ATTENDED" || l.status === "ENROLLED").length;
    const enrolled = leads.filter(l => l.status === "ENROLLED").length;
    const conversionRate = trials > 0 ? ((enrolled / trials) * 100).toFixed(1) : 0;

    // Average time to convert
    const convertedLeads = leads.filter(l => l.status === "ENROLLED");
    const avgTimeMs = convertedLeads.reduce((acc, l) => acc + (new Date(l.updatedAt).getTime() - new Date(l.createdAt).getTime()), 0) / (convertedLeads.length || 1);
    const avgTimeDays = Math.round(avgTimeMs / (1000 * 60 * 60 * 24));

    // Best Source
    const sourceCounts = convertedLeads.reduce((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const bestSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      statusCounts,
      conversionRate,
      avgTimeDays,
      bestSource,
    };
  } catch (error) {
    console.error("Error fetching lead stats:", error);
    return {
      statusCounts: {},
      conversionRate: 0,
      avgTimeDays: 0,
      bestSource: "N/A",
    };
  }
}

import { cleanIndianPhone } from "@/lib/import-utils";

export async function convertLeadToStudent(leadId: string, batchId: string) {
  const auth = await checkPermission("leads.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const orgId = session.orgId;

    const lead = await db.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) throw new Error("Lead not found");
    if (lead.status === "ENROLLED") throw new Error("This lead is already enrolled as a student");

    const batch = await db.batch.findFirst({ where: { id: batchId, orgId } });
    if (!batch) throw new Error("Batch not found");

    const cleanPhone = cleanIndianPhone(lead.parentPhone);
    if (!cleanPhone) throw new Error("Lead parent phone is not a valid 10-digit number");

    const result = await db.$transaction(async (tx) => {
      // Compare-and-swap lock: atomically flip the lead to ENROLLED. If a
      // concurrent conversion already did this, bail before creating duplicates.
      const locked = await tx.lead.updateMany({
        where: { id: lead.id, orgId, status: { not: "ENROLLED" } },
        data: { status: "ENROLLED" },
      });
      if (locked.count === 0) {
        throw new Error("Lead already converted (or being converted by another request).");
      }

      let user = await tx.user.findUnique({ where: { phone: cleanPhone } });
      if (user && user.orgId && user.orgId !== orgId) {
        throw new Error("This phone number is registered with another academy");
      }
      if (user && !user.orgId && user.role !== "PARENT") {
        throw new Error("This phone number belongs to a staff account, not a parent");
      }
      if (user && !user.orgId) {
        user = await tx.user.update({ where: { id: user.id }, data: { orgId } });
      }
      if (!user) {
        user = await tx.user.create({
          data: {
            name: lead.parentName,
            phone: cleanPhone,
            role: "PARENT",
            orgId,
          },
        });
      }

      const approxYear = new Date().getFullYear() - (lead.childAge || 10);
      const student = await tx.student.create({
        data: {
          parentId: user.id,
          name: lead.childName,
          dob: new Date(approxYear, 0, 1),
          orgId,
        },
      });

      await tx.batchEnrollment.create({
        data: {
          batchId: batch.id,
          studentId: student.id,
        },
      });

      // Lead status already set to ENROLLED above by the lock step.

      await tx.auditLog.create({
        data: {
          userId: session.id,
          orgId,
          action: "CONVERT_LEAD_TO_STUDENT",
          details: JSON.stringify({ leadId: lead.id, studentId: student.id, batchId: batch.id }),
        },
      });

      return student;
    });

    revalidatePath("/org");
    return { success: true, student: result };
  } catch (error: any) {
    console.error("Error converting lead to student:", error);
    return { success: false, error: error?.message || "Failed to convert lead to student" };
  }
}
