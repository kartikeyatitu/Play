"use server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth";

// PARENT added: called from the parent dashboard (FeeHistory) for their own children.
export async function getFeeHistory(studentId: string) {
    const session = await requireAuth(['ADMIN', 'PARENT']);
  // Tenant scope via the student: parents only see their own children; admins only their academy
  const studentScope =
    session.role === "PARENT"
      ? { parentId: session.id as string }
      : { orgId: session.orgId || "__no_org__" };
  return db.feeRecord.findMany({
    where: { studentId, student: studentScope },
    orderBy: { month: "desc" },
    take: 6
  })
}
