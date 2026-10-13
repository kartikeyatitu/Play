"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { resolveFeeAmount, istMonthString } from "@/lib/fees";
import { parseDob, cleanIndianPhone } from "@/lib/import-utils";

interface ImportRow {
  studentName: string;
  parentName: string;
  parentPhone: string;
  dob?: string;
  batchName?: string;
  sport?: string;
  feeStatus?: string;
  bloodGroup?: string;
}

export interface ImportRowError {
  row: number; // 1-based position in the file's data rows
  name: string;
  reason: string;
}

const MAX_ROWS = 1000;

export async function importStudents(rows: ImportRow[]) {
  const session = await requireAuth(['ADMIN']);
  try {
    const orgId = session.orgId;
    if (!orgId) return { success: false, error: "No academy found for your account." };
    if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: "The file has no rows to import." };
    if (rows.length > MAX_ROWS) return { success: false, error: `Please import at most ${MAX_ROWS} students at a time (this file has ${rows.length}).` };

    const org = await db.organization.findUnique({ where: { id: orgId }, select: { defaultMonthlyFee: true } });

    let created = 0;
    let skipped = 0;
    const errors: ImportRowError[] = [];
    const batchCache: Record<string, { id: string; monthlyFee: number | null }> = {};
    const fail = (i: number, name: string, reason: string) => {
      skipped++;
      errors.push({ row: i + 1, name: name || "(no name)", reason });
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const studentName = String(row.studentName ?? "").trim();
      const parentName = String(row.parentName ?? "").trim();

      // One bad row must never abort the rest (or leave half a student behind).
      try {
        if (!studentName) { fail(i, studentName, "Missing student name"); continue; }
        if (!parentName) { fail(i, studentName, "Missing parent name"); continue; }

        const phone = cleanIndianPhone(row.parentPhone);
        if (!phone) { fail(i, studentName, `Invalid parent phone "${row.parentPhone ?? ""}" (need a 10-digit mobile number)`); continue; }

        // DOB is optional, but if it's there and unreadable, say so instead of silently dropping it.
        let dob: Date | null = null;
        if (row.dob && String(row.dob).trim()) {
          dob = parseDob(row.dob);
          if (!dob) { fail(i, studentName, `Could not read date of birth "${row.dob}" (use DD/MM/YYYY)`); continue; }
        }

        // Find or create the parent. Never attach a child to a parent who belongs to another academy.
        let parent = await db.user.findFirst({ where: { phone } });
        if (parent && parent.orgId && parent.orgId !== orgId) {
          fail(i, studentName, "This phone number is already registered with a different academy");
          continue;
        }
        if (parent && !parent.orgId && parent.role !== "PARENT") {
          // Never claim an org-less staff/admin account (e.g. an admin mid-onboarding) into this academy
          fail(i, studentName, "This phone number belongs to a staff account, not a parent");
          continue;
        }
        if (!parent) {
          parent = await db.user.create({ data: { name: parentName, phone, role: "PARENT", orgId } });
        } else if (!parent.orgId) {
          parent = await db.user.update({ where: { id: parent.id }, data: { orgId } });
        }

        // Duplicate = same child name under the same parent in this academy
        const existing = await db.student.findFirst({
          where: { name: { equals: studentName, mode: "insensitive" }, parentId: parent.id, orgId },
        });
        if (existing) { fail(i, studentName, "Already in your academy"); continue; }

        // Resolve the batch (exact name first, then partial); auto-create only if nothing matches.
        let batchId: string | null = null;
        let batchFee: number | null = null;
        const batchName = String(row.batchName ?? "").trim();
        if (batchName) {
          const key = batchName.toLowerCase();
          if (!batchCache[key]) {
            let batch =
              (await db.batch.findFirst({ where: { orgId, name: { equals: batchName, mode: "insensitive" } } })) ||
              (await db.batch.findFirst({ where: { orgId, name: { contains: batchName, mode: "insensitive" } } }));
            if (!batch) {
              const firstCoach =
                (await db.user.findFirst({ where: { role: "COACH", orgId } })) ||
                (await db.user.findUnique({ where: { id: session.id } }));
              if (firstCoach) {
                batch = await db.batch.create({
                  data: { orgId, name: batchName, sport: row.sport?.trim() || "General", schedule: "TBD", coachId: firstCoach.id },
                });
              }
            }
            if (batch) batchCache[key] = { id: batch.id, monthlyFee: batch.monthlyFee ?? null };
          }
          if (batchCache[key]) {
            batchId = batchCache[key].id;
            batchFee = batchCache[key].monthlyFee;
          }
        }

        // Student + enrollment + fee record are created together or not at all.
        await db.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: {
              name: studentName,
              parentId: parent!.id,
              orgId,
              dob,
              bloodGroup: row.bloodGroup?.trim() || null,
            },
          });
          if (batchId) {
            await tx.batchEnrollment.create({ data: { studentId: student.id, batchId } });
          }
          if (row.feeStatus && String(row.feeStatus).trim()) {
            const isPaid = String(row.feeStatus).trim().toUpperCase() === "PAID";
            await tx.feeRecord.create({
              data: {
                orgId,
                studentId: student.id,
                amount: resolveFeeAmount({ batchFees: [batchFee], orgDefault: org?.defaultMonthlyFee }),
                month: istMonthString(),
                status: isPaid ? "PAID" : "PENDING",
                paidAt: isPaid ? new Date() : null,
              },
            });
          }
        });

        created++;
      } catch (rowError: any) {
        console.error(`Import row ${i + 1} failed:`, rowError);
        fail(i, studentName, "Could not save this row");
      }
    }

    revalidatePath("/org");
    return { success: true, created, skipped, total: rows.length, errors: errors.slice(0, 25), moreErrors: Math.max(0, errors.length - 25) };
  } catch (e: any) {
    console.error("Import error:", e);
    return { success: false, error: e?.message || "Import failed" };
  }
}
