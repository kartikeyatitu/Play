"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { resolveStudentFee, istMonthString } from "@/lib/fees";

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function exportAllStudentsCSV(): Promise<{ success: boolean; csv?: string; filename?: string; count?: number; error?: string }> {
  try {
    const session = await requireAuth(["ADMIN"]);
    if (!session.orgId) {
      return { success: false, error: "Academy context not found." };
    }

    const orgId = session.orgId;
    const currentMonth = istMonthString();

    const [org, students] = await Promise.all([
      db.organization.findUnique({
        where: { id: orgId },
        select: { name: true, slug: true, defaultMonthlyFee: true },
      }),
      db.student.findMany({
        where: { orgId },
        orderBy: { name: "asc" },
        include: {
          parent: { select: { name: true, phone: true, email: true } },
          enrollments: {
            include: {
              batch: { select: { id: true, name: true, sport: true, monthlyFee: true } },
            },
          },
          feeRecords: {
            where: { month: currentMonth },
            select: { status: true, amount: true, paidAt: true },
          },
        },
      }),
    ]);

    if (!students || students.length === 0) {
      return { success: false, error: "No students found to export." };
    }

    const headers = [
      "Student Name",
      "Date of Birth",
      "Blood Group",
      "Medical Info",
      "Parent Name",
      "Parent Phone",
      "Parent Email",
      "Enrolled Batches",
      "Monthly Fee (INR)",
      `Fee Status (${currentMonth})`,
      "Joined Date",
    ];

    const rows = students.map((s) => {
      const resolvedFee = resolveStudentFee(s, org?.defaultMonthlyFee);
      const currentFeeRecord = s.feeRecords?.[0];
      const feeStatus = currentFeeRecord?.status || (resolvedFee > 0 ? "PENDING" : "FEE NOT SET");
      const batchNames = s.enrollments?.map((e) => e.batch?.name).filter(Boolean).join("; ") || "None";
      const dobStr = s.dob ? new Date(s.dob).toISOString().split("T")[0] : "";
      const joinedStr = s.createdAt ? new Date(s.createdAt).toISOString().split("T")[0] : "";

      return [
        escapeCSV(s.name),
        escapeCSV(dobStr),
        escapeCSV(s.bloodGroup || ""),
        escapeCSV(s.medicalInfo || ""),
        escapeCSV(s.parent?.name || ""),
        escapeCSV(s.parent?.phone || ""),
        escapeCSV(s.parent?.email || ""),
        escapeCSV(batchNames),
        escapeCSV(resolvedFee),
        escapeCSV(feeStatus),
        escapeCSV(joinedStr),
      ].join(",");
    });

    // UTF-8 BOM (\uFEFF) ensures Excel correctly recognizes UTF-8 (Hindi names, special symbols)
    const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(","), ...rows].join("\r\n");
    const safeSlug = (org?.slug || "triq").replace(/[^a-z0-9_-]/gi, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `${safeSlug}_students_${dateStr}.csv`;

    return {
      success: true,
      csv: csvContent,
      filename,
      count: students.length,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to generate CSV." };
  }
}
