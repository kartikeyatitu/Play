"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

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
  try {
    const student = await db.student.findFirst({ where: studentAccessWhere(session, studentId), select: { id: true } });
    if (!student) return { success: false, error: "Student not found" };

    const { bloodGroup, ...rest } = data || {};
    await db.student.update({
      where: { id: student.id },
      data: {
        bloodGroup: bloodGroup || null,
        medicalInfo: JSON.stringify(rest),
      }
    });
    revalidatePath("/org");
    revalidatePath("/student");
    return { success: true };
  } catch (error) {
    console.error("Failed to update medical info:", error);
    return { success: false, error: "Failed to update medical info" };
  }
}
