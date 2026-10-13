"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth";

// Holidays belong to one academy. They used to be global, so every academy saw (and could
// pollute) every other academy's calendar.
export async function addHoliday(title: string, dateStr: string) {
  const session = await requireAuth(['ADMIN']);
  if (!session.orgId) throw new Error("No academy found for your account.");

  const cleanTitle = (title || "").trim().slice(0, 80);
  const date = new Date(dateStr);
  if (!cleanTitle) throw new Error("Please enter a holiday name.");
  if (Number.isNaN(date.getTime())) throw new Error("Please pick a valid date.");

  await db.holiday.create({
    data: { orgId: session.orgId, title: cleanTitle, date },
  })
  revalidatePath("/org")
}

export async function getHolidays() {
  const session = await requireAuth(['ADMIN']);
  if (!session.orgId) return [];
  return db.holiday.findMany({
    where: { orgId: session.orgId },
    orderBy: { date: 'asc' },
  });
}

export async function deleteHoliday(holidayId: string) {
  const session = await requireAuth(['ADMIN']);
  if (!session.orgId) throw new Error("No academy found for your account.");

  const holiday = await db.holiday.findFirst({
    where: { id: holidayId, orgId: session.orgId },
  });
  if (!holiday) throw new Error("Holiday not found");

  await db.holiday.delete({ where: { id: holidayId } });
  revalidatePath("/org");
  return { success: true };
}
