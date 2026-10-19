/**
 * One-shot backfill: create Receipt rows for all PAID FeeRecords that have none.
 *
 * Usage (from project root):
 *   npx tsx scripts/backfill-receipts.ts
 *
 * Safe to run multiple times — getOrCreateReceipt is idempotent per feeRecordId.
 */
import { db } from "../src/lib/db";
import { getOrCreateReceipt } from "../src/lib/receipt-service";

async function main() {
  const orphans = await db.feeRecord.findMany({
    where: {
      status: "PAID",
      receipt: null,
    },
    select: {
      id: true,
      studentId: true,
      orgId: true,
      amount: true,
      month: true,
    },
  });

  console.log(`Found ${orphans.length} PAID fees without receipts.`);
  let created = 0;
  let failed = 0;

  for (const fee of orphans) {
    try {
      // orgId might be null on very old records — skip those
      if (!fee.orgId) {
        const student = await db.student.findUnique({
          where: { id: fee.studentId },
          select: { orgId: true },
        });
        if (!student?.orgId) {
          console.warn(`  SKIP ${fee.id} — no orgId found`);
          failed++;
          continue;
        }
        fee.orgId = student.orgId;
      }

      await getOrCreateReceipt({
        feeRecordId: fee.id,
        studentId: fee.studentId,
        orgId: fee.orgId,
        amount: fee.amount,
        month: fee.month,
        paymentMode: "MANUAL",
      });
      created++;
      if (created % 50 === 0) console.log(`  … ${created}/${orphans.length}`);
    } catch (e) {
      console.error(`  FAIL ${fee.id}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  console.log(`\nDone. Created ${created} receipts, ${failed} failures.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
