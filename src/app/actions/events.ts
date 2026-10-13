"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

// COACH added: matches/events are created from the coach dashboard (CreateMatchModal) for the coach's own batches.
export async function createEvent(batchId: string, title: string, date: Date, location: string) {
    const session = await requireAuth(['ADMIN', 'COACH']);
  const orgId = session.orgId || "__no_org__";
  const batch = await db.batch.findFirst({
    where: session.role === "COACH" ? { id: batchId, orgId, coachId: session.id } : { id: batchId, orgId },
    select: { id: true, orgId: true },
  });
  if (!batch) return { success: false, error: "Batch not found" };
  if (!title || !String(title).trim() || !(date instanceof Date ? !Number.isNaN(date.getTime()) : !Number.isNaN(new Date(date as any).getTime()))) {
    return { success: false, error: "Title and a valid date are required" };
  }

  const event = await db.event.create({ data: { orgId: batch.orgId,  batchId: batch.id, title, date, location }
  });

  // Auto-create PENDING RSVPs for all students in the batch
  const enrollments = await db.batchEnrollment.findMany({ where: { batchId: batch.id } });
  
  const rsvpData = enrollments.map(enr => ({
    eventId: event.id,
    studentId: enr.studentId,
    status: "PENDING",
    orgId: batch.orgId,
  }));

  if (rsvpData.length > 0) {
    await db.rSVP.createMany({ data: rsvpData });
  }

  revalidatePath("/coach");
  revalidatePath("/parent");
  return { success: true };
}

// PARENT added: RSVPs are set from the parent dashboard (RSVPButtons) for their own children.
export async function updateRSVP(eventId: string, studentId: string, status: string) {
    const session = await requireAuth(['ADMIN', 'COACH', 'PARENT']);
  if (!["GOING", "NOT_GOING", "PENDING"].includes(status)) return { success: false, error: "Invalid RSVP status" };
  const orgId = session.orgId || "__no_org__";

  const student = await db.student.findFirst({
    where:
      session.role === "PARENT"
        ? { id: studentId, parentId: session.id }
        : session.role === "COACH"
          ? { id: studentId, orgId, enrollments: { some: { batch: { coachId: session.id, orgId } } } }
          : { id: studentId, orgId },
    select: { id: true, orgId: true },
  });
  if (!student) return { success: false, error: "Student not found" };

  // Event must be for a batch the student is enrolled in (and therefore the same academy)
  const event = await db.event.findFirst({
    where: { id: eventId, batch: { enrollments: { some: { studentId: student.id } } } },
    select: { id: true },
  });
  if (!event) return { success: false, error: "Event not found" };

  await db.rSVP.upsert({
    where: { eventId_studentId: { eventId: event.id, studentId: student.id } },
    update: { status },
    create: { eventId: event.id, studentId: student.id, status, orgId: student.orgId }
  });
  revalidatePath("/parent");
  revalidatePath("/coach");
  return { success: true };
}
