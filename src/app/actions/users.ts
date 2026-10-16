"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { coachesOfOrg, requirePermission } from "@/lib/membership";

import { cleanIndianPhone } from "@/lib/import-utils";

export async function createCoach(formData: FormData) {
  // Coaches are team members: one login can coach at several academies (see actions/team.ts).
  const { addTeamMember } = await import("@/app/actions/team");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "");
  if (!name || !cleanIndianPhone(phone)) {
    throw new Error("Valid name and 10-digit Indian mobile number are required");
  }
  const added = await addTeamMember({ name, phone, role: "COACH" });
  if (!added.ok) throw new Error(added.error);
  return { success: true };
}

export async function updateCoach(coachId: string, data: { name?: string; phone?: string }) {
  const { session } = await requirePermission("team.manage");

  const coach = await db.user.findFirst({
    where: { id: coachId, ...coachesOfOrg(session.orgId) },
  });
  if (!coach) throw new Error("Coach not found");

  const updateData: any = {};
  if (data.name?.trim()) updateData.name = data.name.trim();
  if (data.phone) {
    const cleanPhone = cleanIndianPhone(data.phone);
    if (!cleanPhone) throw new Error("Invalid phone number");
    updateData.phone = cleanPhone;
  }

  await db.user.update({
    where: { id: coachId },
    data: updateData,
  });

  revalidatePath("/org");
  return { success: true };
}

export async function createStudent(formData: FormData) {
  const { session } = await requirePermission("students.manage");
  const studentName = formData.get("studentName") as string;
  const dobString = formData.get("dob") as string;
  const parentName = formData.get("parentName") as string;
  const parentPhone = formData.get("parentPhone") as string;
  const batchId = formData.get("batchId") as string;
  // Tenant scope: never trust an orgId from the form — always use the admin's own org
  const orgId = session.orgId;

  if (!studentName || !dobString || !parentName || !parentPhone || !orgId) {
    throw new Error("Missing required fields");
  }

  // If a batch was selected it must belong to this academy
  if (batchId) {
    const batch = await db.batch.findFirst({ where: { id: batchId, orgId } });
    if (!batch) throw new Error("Batch not found");
  }

  // Quota check: free tier max 30 students + 14-day grace period
  const { checkStudentQuota } = await import("@/lib/billing-service");
  const quota = await checkStudentQuota(orgId);
  if (!quota.allowed) {
    throw new Error(quota.error || "Academy student quota reached. Please upgrade your Triq plan.");
  }

  // Using a transaction to ensure both Parent and Student are created cleanly
  await db.$transaction(async (tx) => {
    // 1. Find or create the Parent User
    let parent = await tx.user.findUnique({
      where: { phone: parentPhone },
    });

    if (parent && parent.orgId && parent.orgId !== orgId) {
      // Phone is globally unique; never attach a student to another academy's user
      throw new Error("This phone number is registered with another academy");
    }
    if (parent && !parent.orgId && parent.role !== "PARENT") {
      // Never claim an org-less staff/admin account (e.g. an admin mid-onboarding) into this academy
      throw new Error("This phone number belongs to a staff account, not a parent");
    }
    if (parent && !parent.orgId) {
      // Org-less parent: link them to this academy so the child and parent share one tenant
      parent = await tx.user.update({ where: { id: parent.id }, data: { orgId } });
    }

    if (!parent) {
      parent = await tx.user.create({
        data: {
          name: parentName,
          phone: parentPhone,
          role: "PARENT",
          orgId,
        },
      });
    } else if (parent.role !== "PARENT") {
        // Ensure they at least have a parent role if they were just a basic user
        // (If they are a COACH who is also a PARENT, we leave their role as COACH for now to preserve access)
    }

    // 2. Create the Student
    const student = await tx.student.create({
      data: {
        name: studentName,
        dob: new Date(dobString),
        parentId: parent.id,
        orgId,
      },
    });

    // 3. Immediately enroll them in a batch if the Org selected one
    if (batchId) {
      await tx.batchEnrollment.create({
        data: {
          batchId,
          studentId: student.id,
        },
      });
    }
  });

  revalidatePath("/org");
  return { success: true };
}

export async function updateStudent(
  studentId: string,
  data: {
    name?: string;
    dob?: string;
    parentName?: string;
    parentPhone?: string;
    batchId?: string;
  }
) {
  const { session } = await requirePermission("students.manage");

  const student = await db.student.findFirst({
    where: { id: studentId, orgId: session.orgId },
    include: { parent: true, enrollments: true },
  });
  if (!student) throw new Error("Student not found");

  await db.$transaction(async (tx) => {
    const studentUpdate: any = {};
    if (data.name?.trim()) studentUpdate.name = data.name.trim();
    if (data.dob) studentUpdate.dob = new Date(data.dob);

    if (Object.keys(studentUpdate).length > 0) {
      await tx.student.update({
        where: { id: studentId },
        data: studentUpdate,
      });
    }

    if (data.parentPhone && student.parentId) {
      const cleanPhone = cleanIndianPhone(data.parentPhone);
      if (!cleanPhone) throw new Error("Invalid parent phone number");
      const parentUpdate: any = { phone: cleanPhone };
      if (data.parentName?.trim()) parentUpdate.name = data.parentName.trim();
      await tx.user.update({
        where: { id: student.parentId },
        data: parentUpdate,
      });
    }

    if (data.batchId !== undefined) {
      // Remove existing enrollments
      await tx.batchEnrollment.deleteMany({
        where: { studentId },
      });
      // Add new enrollment if specified
      if (data.batchId) {
        const batch = await tx.batch.findFirst({
          where: { id: data.batchId, orgId: session.orgId },
        });
        if (batch) {
          await tx.batchEnrollment.create({
            data: { batchId: data.batchId, studentId },
          });
        }
      }
    }
  });

  revalidatePath("/org");
  return { success: true };
}

export async function deleteStudent(studentId: string) {
  const { session } = await requirePermission("students.manage");

  const student = await db.student.findFirst({
    where: { id: studentId, orgId: session.orgId },
  });
  if (!student) throw new Error("Student not found");

  await db.$transaction(async (tx) => {
    // Delete cascading references safely
    await tx.attendance.deleteMany({ where: { studentId } });
    await tx.batchEnrollment.deleteMany({ where: { studentId } });
    await tx.feeRecord.deleteMany({ where: { studentId } });
    await tx.payment.deleteMany({ where: { studentId } });
    await tx.skillReport.deleteMany({ where: { studentId } });
    await tx.student.delete({ where: { id: studentId } });

    await tx.auditLog.create({
      data: {
        userId: session.id,
        orgId: session.orgId,
        action: "DELETE_STUDENT",
        details: JSON.stringify({ studentId, name: student.name }),
      },
    });
  });

  revalidatePath("/org");
  return { success: true };
}
