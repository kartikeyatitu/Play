"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth";

export async function reportIncident(
  studentId: string,
  coachId: string,
  type: string,
  description: string,
  severity: string
) {
    const session = await requireAuth(['COACH', 'ADMIN']);
  const orgId = session.orgId || "__no_org__";

  // Tenant scope: coaches only for students in their own batches; admins for any student in-org
  const student = await db.student.findFirst({
    where: session.role === "COACH"
      ? { id: studentId, orgId, enrollments: { some: { batch: { coachId: session.id, orgId } } } }
      : { id: studentId, orgId },
    select: { id: true },
  });
  if (!student) throw new Error("Student not found");

  // Never trust coachId: coaches always report as themselves; admins may attribute to a staff member in-org
  let reporterId = session.id as string;
  if (session.role === "ADMIN" && coachId && coachId !== session.id) {
    const staff = await db.user.findFirst({ where: { id: coachId, orgId, role: { in: ["COACH", "ADMIN"] } }, select: { id: true } });
    if (staff) reporterId = staff.id;
  }

  await db.incident.create({ data: { orgId: session.orgId, 
      studentId: student.id,
      coachId: reporterId,
      type,
      description,
      severity
    }
  })
  // Assuming this is viewed on some coach dashboard
  revalidatePath("/coach")
}
