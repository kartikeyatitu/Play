"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/membership";
import { istToday, istWeekday, scheduleRunsOn } from "@/lib/fees";

export async function generateTodaySessions() {
  const { session } = await requirePermission("batches.manage");
  // "Today" in Asia/Kolkata (stored as 00:00 UTC of the IST calendar day)
  const today = istToday();
  const dayName = istWeekday();

  // Only this academy's batches (previously this created sessions for every academy)
  const batches = await db.batch.findMany({ where: { orgId: session.orgId } });
  
  let created = 0;
  let skipped = 0;

  for (const batch of batches) {
    if (!batch.schedule) {
      continue;
    }
    
    // Check if the schedule runs today (Mon/Wed/Fri, Mon-Fri, Daily, Weekends…)
    if (scheduleRunsOn(batch.schedule, dayName)) {
      const existingSession = await db.session.findFirst({
        where: {
          batchId: batch.id,
          date: today,
        },
      });

      if (!existingSession) {
        await db.session.create({
          data: {
            batchId: batch.id,
            date: today,
            status: "SCHEDULED",
            orgId: session.orgId,
          },
        });
        created++;
      } else {
        skipped++;
      }
    }
  }

  revalidatePath("/");
  return { created, skipped };
}
