"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { cleanIndianPhone } from "@/lib/import-utils";
import { istToday } from "@/lib/fees";
import { backfillOrgMemberships, getMembership, requireMember, requirePermission } from "@/lib/membership";
import {
  appRoleFor,
  effectivePermissions,
  isPayType,
  isPermission,
  isStaffAttendanceStatus,
  isStaffRole,
  isTeamRole,
  type Permission,
  type StaffAttendanceStatus,
  type TeamRole,
} from "@/lib/team";

type TeamMemberInput = {
  name: string;
  phone: string;
  role: string;
  staffRole?: string | null;
  title?: string | null;
  payType?: string | null;
  payAmount?: number | string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } }).catch(() => {});
}

function cleanPay(payType?: string | null, payAmount?: number | string | null) {
  const type = isPayType(payType) ? payType : null;
  const amount = payAmount === null || payAmount === undefined || payAmount === "" ? null : Math.round(Number(payAmount));
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000)) throw new Error("Enter a valid pay amount");
  return { payType: type, payAmount: type ? amount : null };
}

/** The whole team of the active academy, with today's attendance for each person. */
export async function getTeam() {
  const { session, membership } = await requireMember(["ADMIN"]);
  const orgId = session.orgId;
  await backfillOrgMemberships(orgId);
  const today = istToday();

  const members = await db.orgMembership.findMany({
    where: { orgId, status: { not: "REMOVED" } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      id: true,
      role: true,
      staffRole: true,
      title: true,
      status: true,
      payType: true,
      payAmount: true,
      permissions: true,
      joinedAt: true,
      user: { select: { id: true, name: true, phone: true, verified: true, lastSeenAt: true, batches: { where: { orgId }, select: { id: true, name: true } } } },
      attendance: { where: { date: today }, select: { status: true, checkInAt: true, checkOutAt: true } },
    },
  });

  const viewerPerms = effectivePermissions(membership.role, membership.staffRole, membership.permissions);
  const canSeePay = viewerPerms.has("payroll.view");

  return {
    viewer: { membershipId: membership.id, role: membership.role, permissions: [...viewerPerms] },
    today: today.toISOString(),
    members: members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      phone: m.user.phone,
      role: m.role,
      staffRole: m.staffRole,
      title: m.title,
      status: m.status,
      payType: canSeePay ? m.payType : null,
      payAmount: canSeePay ? m.payAmount : null,
      permissions: [...effectivePermissions(m.role, m.staffRole, m.permissions)],
      joinedAt: m.joinedAt.toISOString(),
      lastSeenAt: m.user.lastSeenAt?.toISOString() ?? null,
      batches: m.user.batches,
      todayAttendance: m.attendance[0]
        ? {
            status: m.attendance[0].status,
            checkInAt: m.attendance[0].checkInAt?.toISOString() ?? null,
            checkOutAt: m.attendance[0].checkOutAt?.toISOString() ?? null,
          }
        : null,
    })),
  };
}

/**
 * Add a coach or staff member by phone. A coach who already works at another academy keeps their
 * login and gets this academy added to their list; parents and other academies' owners are refused.
 */
export async function addTeamMember(input: TeamMemberInput) {
  const { session } = await requirePermission("team.manage");
  const orgId = session.orgId;

  const name = String(input.name || "").trim().slice(0, 80);
  const phone = cleanIndianPhone(input.phone);
  const role = input.role;
  if (!name) throw new Error("Enter the person's name");
  if (!phone) throw new Error("Enter a valid 10-digit mobile number");
  if (!isTeamRole(role) || role === "OWNER") throw new Error("Choose manager, coach or staff");
  const staffRole = role === "STAFF" ? (isStaffRole(input.staffRole) ? input.staffRole : "OTHER") : null;
  const title = input.title ? String(input.title).trim().slice(0, 60) || null : null;
  const pay = cleanPay(input.payType, input.payAmount);

  const existing = await db.user.findUnique({
    where: { phone },
    select: { id: true, role: true, orgId: true, memberships: { select: { orgId: true, role: true, status: true } } },
  });

  if (existing) {
    if (existing.role === "PARENT") throw new Error("This number is registered as a parent. Use a different number for staff.");
    if (existing.role === "SUPER_ADMIN") throw new Error("This number can't be added to a team");
    const ownsOtherAcademy = existing.memberships.some((m) => m.role === "OWNER" && m.orgId !== orgId && m.status === "ACTIVE")
      || (existing.role === "ADMIN" && existing.orgId && existing.orgId !== orgId);
    if (ownsOtherAcademy) throw new Error("This number owns another academy on Triq");

    const here = existing.memberships.find((m) => m.orgId === orgId);
    if (here && here.status !== "REMOVED") throw new Error("This person is already in your team");
  }

  const appRole = appRoleFor(role);
  await db.$transaction(async (tx) => {
    let userId = existing?.id;
    if (!userId) {
      const user = await tx.user.create({ data: { name, phone, role: appRole, orgId } });
      userId = user.id;
    } else if (!existing!.orgId) {
      // No active academy yet (e.g. first job, or removed from their last one): make this one active
      await tx.user.update({ where: { id: userId }, data: { orgId, role: appRole } });
    }
    await tx.orgMembership.upsert({
      where: { userId_orgId: { userId, orgId } },
      create: { userId, orgId, role, staffRole, title, ...pay },
      update: { role, staffRole, title, ...pay, status: "ACTIVE", removedAt: null, joinedAt: new Date() },
    });
  });

  await audit(session.id, orgId, "TEAM_MEMBER_ADDED", { phone: `******${phone.slice(-4)}`, role, staffRole });
  revalidatePath("/org");
  return { success: true, joinedOtherAcademy: !!existing?.orgId && existing.orgId !== orgId };
}

/** Change someone's role, title, pay or individual permissions. */
export async function updateTeamMember(
  membershipId: string,
  data: { role?: string; staffRole?: string | null; title?: string | null; payType?: string | null; payAmount?: number | string | null; permissions?: Record<string, boolean> }
) {
  const { session, membership: me } = await requirePermission("team.manage");
  const orgId = session.orgId;
  const target = await db.orgMembership.findFirst({ where: { id: membershipId, orgId, status: { not: "REMOVED" } } });
  if (!target) throw new Error("Team member not found");
  if (target.role === "OWNER" && me.role !== "OWNER") throw new Error("Only the owner can change the owner's details");

  const update: Record<string, unknown> = {};
  if (data.role !== undefined) {
    if (target.role === "OWNER") throw new Error("The owner's role can't be changed here");
    if (!isTeamRole(data.role) || data.role === "OWNER") throw new Error("Choose manager, coach or staff");
    if (data.role === "MANAGER" && me.role !== "OWNER") throw new Error("Only the owner can make someone a manager");
    update.role = data.role;
    update.staffRole = data.role === "STAFF" ? (isStaffRole(data.staffRole) ? data.staffRole : "OTHER") : null;
  } else if (data.staffRole !== undefined && target.role === "STAFF") {
    update.staffRole = isStaffRole(data.staffRole) ? data.staffRole : "OTHER";
  }
  if (data.title !== undefined) update.title = data.title ? String(data.title).trim().slice(0, 60) || null : null;
  if (data.payType !== undefined || data.payAmount !== undefined) {
    const viewer = effectivePermissions(me.role, me.staffRole, me.permissions);
    if (!viewer.has("payroll.manage")) throw new Error("You don't have permission to change pay");
    Object.assign(update, cleanPay(data.payType ?? target.payType, data.payAmount ?? target.payAmount));
  }
  if (data.permissions !== undefined) {
    if (me.role !== "OWNER") throw new Error("Only the owner can change permissions");
    const clean: Partial<Record<Permission, boolean>> = {};
    for (const [k, v] of Object.entries(data.permissions || {})) if (isPermission(k) && typeof v === "boolean" && k !== "settings.manage") clean[k] = v;
    update.permissions = Object.keys(clean).length ? JSON.stringify(clean) : null;
  }
  if (!Object.keys(update).length) return { success: true };

  await db.$transaction(async (tx) => {
    await tx.orgMembership.update({ where: { id: target.id }, data: update });
    // If their role changed and this is their active academy, move them to the matching app
    if (update.role) {
      const user = await tx.user.findUnique({ where: { id: target.userId }, select: { orgId: true } });
      if (user?.orgId === orgId) await tx.user.update({ where: { id: target.userId }, data: { role: appRoleFor(update.role as TeamRole) } });
    }
  });
  await audit(session.id, orgId, "TEAM_MEMBER_UPDATED", { membershipId, fields: Object.keys(update) });
  revalidatePath("/org");
  return { success: true };
}

/** Remove someone from this academy. Their login and history stay; they lose access here. */
export async function removeTeamMember(membershipId: string) {
  const { session, membership: me } = await requirePermission("team.manage");
  const orgId = session.orgId;
  const target = await db.orgMembership.findFirst({ where: { id: membershipId, orgId, status: { not: "REMOVED" } } });
  if (!target) throw new Error("Team member not found");
  if (target.role === "OWNER") throw new Error("The owner can't be removed");
  if (target.id === me.id) throw new Error("You can't remove yourself");
  if (target.role === "MANAGER" && me.role !== "OWNER") throw new Error("Only the owner can remove a manager");

  const assignedBatches = await db.batch.count({ where: { orgId, coachId: target.userId } });

  await db.$transaction(async (tx) => {
    await tx.orgMembership.update({ where: { id: target.id }, data: { status: "REMOVED", removedAt: new Date() } });
    const user = await tx.user.findUnique({ where: { id: target.userId }, select: { orgId: true } });
    if (user?.orgId === orgId) {
      // Move them to another academy they still belong to, or leave them without an active academy
      const next = await tx.orgMembership.findFirst({ where: { userId: target.userId, status: "ACTIVE", orgId: { not: orgId } }, orderBy: { joinedAt: "asc" } });
      await tx.user.update({
        where: { id: target.userId },
        data: next ? { orgId: next.orgId, role: appRoleFor(next.role as TeamRole) } : { orgId: null, sessionVersion: { increment: 1 } },
      });
    }
  });
  await audit(session.id, orgId, "TEAM_MEMBER_REMOVED", { membershipId, role: target.role, assignedBatches });
  revalidatePath("/org");
  return { success: true, assignedBatches };
}

/** Owner/manager marks a team member's attendance for a day (defaults to today, India time). */
export async function markStaffAttendance(membershipId: string, status: string, dateIso?: string, note?: string) {
  const { session } = await requirePermission("team.manage");
  const orgId = session.orgId;
  if (!isStaffAttendanceStatus(status)) throw new Error("Choose present, absent, leave or half day");
  const target = await db.orgMembership.findFirst({ where: { id: membershipId, orgId, status: "ACTIVE" } });
  if (!target) throw new Error("Team member not found");

  const today = istToday();
  const date = dateIso ? istToday(new Date(dateIso)) : today;
  if (date.getTime() > today.getTime()) throw new Error("You can't mark attendance for a future day");
  if (today.getTime() - date.getTime() > 62 * DAY_MS) throw new Error("Attendance older than two months can't be changed");

  const cleanNote = note ? String(note).trim().slice(0, 200) || null : undefined;
  await db.staffAttendance.upsert({
    where: { membershipId_date: { membershipId, date } },
    create: { membershipId, orgId, date, status, note: cleanNote ?? null, markedById: session.id },
    update: { status, ...(cleanNote !== undefined ? { note: cleanNote } : {}), markedById: session.id },
  });
  revalidatePath("/org");
  return { success: true };
}

/** Attendance for every team member for one month ("YYYY-MM"), for the register view and payroll. */
export async function getStaffAttendanceMonth(month: string) {
  const { session } = await requirePermission("team.manage");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const rows = await db.staffAttendance.findMany({
    where: { orgId: session.orgId, date: { gte: start, lt: end } },
    select: { membershipId: true, date: true, status: true },
  });
  return rows.map((r) => ({ membershipId: r.membershipId, date: r.date.toISOString().slice(0, 10), status: r.status as StaffAttendanceStatus }));
}

/** Coach or staff checks themselves in for today. */
export async function selfCheckIn() {
  const { session, membership } = await requireMember(["ADMIN", "COACH", "STAFF"]);
  const date = istToday();
  const now = new Date();
  const existing = await db.staffAttendance.findUnique({ where: { membershipId_date: { membershipId: membership.id, date } } });
  if (existing?.checkInAt) return { success: true, alreadyCheckedIn: true, checkInAt: existing.checkInAt.toISOString() };
  await db.staffAttendance.upsert({
    where: { membershipId_date: { membershipId: membership.id, date } },
    create: { membershipId: membership.id, orgId: session.orgId, date, status: "PRESENT", checkInAt: now, markedById: session.id },
    update: { status: "PRESENT", checkInAt: now },
  });
  revalidatePath("/staff");
  revalidatePath("/coach");
  return { success: true, checkInAt: now.toISOString() };
}

/** Coach or staff checks out at the end of the day. */
export async function selfCheckOut() {
  const { membership } = await requireMember(["ADMIN", "COACH", "STAFF"]);
  const date = istToday();
  const existing = await db.staffAttendance.findUnique({ where: { membershipId_date: { membershipId: membership.id, date } } });
  if (!existing?.checkInAt) throw new Error("Check in first");
  if (existing.checkOutAt) return { success: true, alreadyCheckedOut: true, checkOutAt: existing.checkOutAt.toISOString() };
  const now = new Date();
  await db.staffAttendance.update({ where: { id: existing.id }, data: { checkOutAt: now } });
  revalidatePath("/staff");
  revalidatePath("/coach");
  return { success: true, checkOutAt: now.toISOString() };
}

/** The signed-in person's own attendance for the current month plus today's record. */
export async function getMyAttendance() {
  const { session, membership } = await requireMember(["ADMIN", "COACH", "STAFF"]);
  const today = istToday();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const rows = await db.staffAttendance.findMany({
    where: { membershipId: membership.id, date: { gte: start } },
    orderBy: { date: "desc" },
    select: { date: true, status: true, checkInAt: true, checkOutAt: true },
  });
  const todayRow = rows.find((r) => r.date.getTime() === today.getTime());
  const org = await db.organization.findUnique({ where: { id: session.orgId }, select: { name: true } });
  return {
    academyName: org?.name ?? "",
    role: membership.role,
    staffRole: membership.staffRole,
    today: todayRow
      ? { status: todayRow.status, checkInAt: todayRow.checkInAt?.toISOString() ?? null, checkOutAt: todayRow.checkOutAt?.toISOString() ?? null }
      : null,
    month: rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), status: r.status })),
    presentDays: rows.filter((r) => r.status === "PRESENT").length + rows.filter((r) => r.status === "HALF_DAY").length / 2,
  };
}

/** Every academy the signed-in person works at, for the academy switcher. */
export async function getMyAcademies() {
  const session = await requireAuth(["ADMIN", "COACH", "STAFF"]);
  if (session.orgId) await getMembership(session.id, session.orgId); // backfill legacy data
  const memberships = await db.orgMembership.findMany({
    where: { userId: session.id, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: { orgId: true, role: true, staffRole: true, org: { select: { name: true, city: true } } },
  });
  return memberships.map((m) => ({
    orgId: m.orgId,
    name: m.org.name,
    city: m.org.city,
    role: m.role,
    staffRole: m.staffRole,
    active: m.orgId === session.orgId,
  }));
}

/** Switch the person's active academy. Returns where to send them next. */
export async function switchAcademy(orgId: string) {
  const session = await requireAuth(["ADMIN", "COACH", "STAFF"]);
  const membership = await db.orgMembership.findUnique({ where: { userId_orgId: { userId: session.id, orgId: String(orgId) } } });
  if (!membership || membership.status !== "ACTIVE") throw new Error("You are not a member of that academy");
  const appRole = appRoleFor(membership.role as TeamRole);
  await db.user.update({ where: { id: session.id }, data: { orgId: membership.orgId, role: appRole } });
  return { success: true, redirectTo: appRole === "ADMIN" ? "/org" : appRole === "COACH" ? "/coach" : "/staff" };
}
