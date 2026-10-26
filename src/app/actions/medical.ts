"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { medicalAuditDetails, medicalFieldsChanged, parseMedicalJson, whitelistMedical } from "@/lib/health";

// Tenant/role scope for a student:
// ADMIN → any student in their academy; COACH → students in their own batches;
// PARENT → only their own children.
function studentAccessWhere(session: { id: string; role: string; orgId: string | null }, studentId: string) {
  const orgId = session.orgId || "__no_org__";
  if (session.role === "PARENT") return { id: studentId, parentId: session.id };
  if (session.role === "COACH") {
    return { id: studentId, orgId, enrollments: { some: { batch: { coachId: session.id, orgId } } } };
  }
  return { id: studentId, orgId };
}

/** Payload shape for updateMedicalInfo. All fields optional; unknown keys are ignored. */
export interface MedicalInfoInput {
  bloodGroup?: string | null;
  allergies?: string;
  medications?: string;
  conditions?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  dietaryNotes?: string;
  [extra: string]: unknown; // forward-compat for new fields the UI adds
}

export async function updateMedicalInfo(studentId: string, data: MedicalInfoInput) {
    // PARENT added: the MedicalForm is rendered on /student/[id] for parents too (own children only)
    const session = await requireAuth(['ADMIN', 'COACH', 'PARENT']);
  // V6 Wellness: with the flag on, owners/managers need health.manage (revocable per person).
  if (FEATURES.wellness && session.role === "ADMIN") {
    const auth = await checkPermission("health.manage");
    if (!auth.ok) return { success: false, error: auth.error };
  }
  try {
    const student = await db.student.findFirst({
      where: studentAccessWhere(session, studentId),
      select: { id: true, orgId: true, medicalInfo: true, bloodGroup: true },
    });
    if (!student) return { success: false, error: "Student not found" };

    const { bloodGroup, ...rest } = data || {};
    // Flag on: only whitelisted medical keys are stored (unknown keys are dropped).
    const stored: Record<string, unknown> = FEATURES.wellness ? whitelistMedical(rest) : rest;
    const nextBloodGroup = typeof bloodGroup === "string" && bloodGroup.trim() ? bloodGroup.trim().slice(0, 10) : null;
    await db.student.update({
      where: { id: student.id },
      data: {
        bloodGroup: nextBloodGroup,
        medicalInfo: JSON.stringify(stored),
      }
    });

    // Audit WHICH fields changed — never the values (health data).
    const fields = medicalFieldsChanged(
      { ...parseMedicalJson(student.medicalInfo), bloodGroup: student.bloodGroup },
      { ...stored, bloodGroup: nextBloodGroup },
    );
    if (fields.length) {
      await db.auditLog
        .create({
          data: {
            userId: session.id,
            orgId: student.orgId ?? session.orgId ?? null,
            action: "MEDICAL_INFO_UPDATED",
            details: JSON.stringify(medicalAuditDetails(student.id, fields)),
          },
        })
        .catch((e) => console.error("[medical] audit failed", e?.message));
    }
    revalidatePath("/org");
    revalidatePath("/student");
    return { success: true };
  } catch (error) {
    console.error("Failed to update medical info:", error);
    return { success: false, error: "Failed to update medical info" };
  }
}
