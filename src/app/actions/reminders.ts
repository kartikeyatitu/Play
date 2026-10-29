'use server'

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";

export type ReminderType = 
  | 'SESSION_TOMORROW' 
  | 'PROGRESS_UPDATE' 
  | 'STREAK_MILESTONE' 
  | 'BIRTHDAY' 
  | 'EVENT_REMINDER' 
  | 'TRIAL_FOLLOW_UP' 
  | 'ABSENT_STREAK' 
  | 'FEE_DUE'

export interface Reminder {
  type: ReminderType
  parentName: string
  parentPhone: string
  studentName: string
  message: string
  waLink: string
  metadata?: any
}

function waLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

export async function getAutoReminders(): Promise<Reminder[]> {
  const session = await requireAuth(['ADMIN']);
  const orgId = session.orgId || "__no_org__";
  // Tenant scope: never fall back to `{}` (which would read every academy's data)
  const orgFilter = { orgId };
  const academyName = session.orgName || "the academy";

  const reminders: Reminder[] = [];
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(todayStart);
  dayAfter.setDate(dayAfter.getDate() + 2);

  // Fetch students with full context in a single query
  const students = await db.student.findMany({
    where: orgFilter,
    include: {
      parent: true,
      enrollments: { include: { batch: true } },
      attendances: { take: 15, orderBy: { sessionId: 'desc' } },
      skillReports: { take: 1, orderBy: { createdAt: 'desc' } },
      feeRecords: { where: { status: 'PENDING' }, take: 1 },
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 1. 🏟️ SESSION TOMORROW — "Training at 5 PM tomorrow!"
  // ═══════════════════════════════════════════════════════════
  const tomorrowDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][tomorrow.getDay()];
  const tomorrowSessions = await db.session.findMany({
    where: {
      date: { gte: tomorrow, lt: dayAfter },
      ...orgFilter,
    },
    include: {
      batch: { include: { enrollments: { include: { student: { include: { parent: true } } } } } }
    }
  });

  const notifiedForSession = new Set<string>();
  for (const sess of tomorrowSessions) {
    for (const enr of sess.batch.enrollments) {
      const st = enr.student;
      if (!st.parent?.phone) continue;
      const key = `${st.id}-${sess.batchId}`;
      if (notifiedForSession.has(key)) continue;
      notifiedForSession.add(key);

      const schedule = sess.batch.schedule || `${tomorrowDay}`;
      const message = `Hi ${st.parent.name}! Reminder: ${st.name}'s ${sess.batch.sport || "training"} session is tomorrow (${tomorrowDay}). Schedule: ${schedule}. See you at ${academyName}! 💪`;
      reminders.push({
        type: 'SESSION_TOMORROW',
        parentName: st.parent.name,
        parentPhone: st.parent.phone,
        studentName: st.name,
        message,
        waLink: waLink(st.parent.phone, message),
        metadata: { batch: sess.batch.name, sport: sess.batch.sport }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. 📈 PROGRESS UPDATE — Skill level ups & report highlights
  // ═══════════════════════════════════════════════════════════
  for (const st of students) {
    if (!st.parent?.phone) continue;
    const report = st.skillReports?.[0];
    if (report) {
      const reportAge = (today.getTime() - new Date(report.createdAt).getTime()) / 86400000;
      if (reportAge <= 7) {
        const batchName = st.enrollments?.[0]?.batch?.name || "their batch";
        const avgScore = Math.round((report.technique + report.fitness + report.discipline) / 3);
        const message = `Great news, ${st.parent.name}! 📊 ${st.name}'s latest skill assessment is in for ${batchName}. Scores: Technique ${report.technique}/10, Fitness ${report.fitness}/10, Discipline ${report.discipline}/10. Avg: ${avgScore}/10. Keep up the excellent work, champion! 🏆`;
        reminders.push({
          type: 'PROGRESS_UPDATE',
          parentName: st.parent.name,
          parentPhone: st.parent.phone,
          studentName: st.name,
          message,
          waLink: waLink(st.parent.phone, message),
          metadata: { avgScore, technique: report.technique, fitness: report.fitness, discipline: report.discipline }
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 3. 🔥 STREAK MILESTONE — 5, 10, 15, 20 consecutive sessions
  // ═══════════════════════════════════════════════════════════
  for (const st of students) {
    if (!st.parent?.phone) continue;
    let streak = 0;
    for (const a of st.attendances) {
      if (a.isPresent) streak++;
      else break;
    }
    const milestones = [20, 15, 10, 5];
    for (const m of milestones) {
      if (streak >= m) {
        const emoji = m >= 15 ? "🏅" : m >= 10 ? "⭐" : "🔥";
        const message = `${emoji} Incredible, ${st.parent.name}! ${st.name} has an amazing ${streak}-session attendance streak! Consistency is the key to greatness. Keep it going, champion! 💪`;
        reminders.push({
          type: 'STREAK_MILESTONE',
          parentName: st.parent.name,
          parentPhone: st.parent.phone,
          studentName: st.name,
          message,
          waLink: waLink(st.parent.phone, message),
          metadata: { streak }
        });
        break; // Only the highest milestone
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. 🎂 BIRTHDAY — Today or tomorrow
  // ═══════════════════════════════════════════════════════════
  for (const student of students) {
    if (!student.dob || !student.parent?.phone) continue;
    const dob = new Date(student.dob);
    const isBirthdayToday = dob.getDate() === todayStart.getDate() && dob.getMonth() === todayStart.getMonth();
    const isBirthdayTomorrow = dob.getDate() === tomorrow.getDate() && dob.getMonth() === tomorrow.getMonth();

    if (isBirthdayToday || isBirthdayTomorrow) {
      const when = isBirthdayToday ? "today" : "tomorrow";
      const age = today.getFullYear() - dob.getFullYear();
      const message = `🎂 Happy Birthday ${student.name}! Turning ${age} ${when}! Wishing you a champion year ahead filled with goals, wins, and great memories at ${academyName}! 🎉🏆`;
      reminders.push({
        type: 'BIRTHDAY',
        parentName: student.parent.name,
        parentPhone: student.parent.phone,
        studentName: student.name,
        message,
        waLink: waLink(student.parent.phone, message),
        metadata: { age, when }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 5. 📅 EVENT REMINDER — Events in next 3 days
  // ═══════════════════════════════════════════════════════════
  const threeDaysFromNow = new Date(todayStart);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const upcomingEvents = await db.event.findMany({
    where: {
      date: { gte: todayStart, lte: threeDaysFromNow },
      orgId
    },
    include: {
      rsvps: { include: { student: { include: { parent: true } } } }
    }
  });

  for (const event of upcomingEvents) {
    for (const rsvp of event.rsvps) {
      if (rsvp.status === 'GOING' && rsvp.student?.parent?.phone) {
        const eventDate = new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
        const message = `Hi ${rsvp.student.parent.name}! 📅 Reminder: ${event.title} is coming up on ${eventDate}${event.location ? ` at ${event.location}` : ''}. Don't miss it! See you there! 🎯`;
        reminders.push({
          type: 'EVENT_REMINDER',
          parentName: rsvp.student.parent.name,
          parentPhone: rsvp.student.parent.phone,
          studentName: rsvp.student.name,
          message,
          waLink: waLink(rsvp.student.parent.phone, message)
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. 🏃 TRIAL FOLLOW-UP — Pending trials from 1+ days ago
  // ═══════════════════════════════════════════════════════════
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);

  const pendingTrials = await db.trialBooking.findMany({
    where: {
      status: 'PENDING',
      date: { lte: yesterday },
      // TrialBooking has no orgId column — scope via its batch
      batch: { orgId }
    },
    include: { batch: true },
    take: 10
  });

  for (const trial of pendingTrials) {
    if (!trial.parentPhone) continue;
    const batchInfo = trial.batch?.name ? ` in ${trial.batch.name}` : '';
    const message = `Hi ${trial.parentName}! Hope ${trial.childName} enjoyed the trial session${batchInfo}! We'd love to have them join our regular training. Ready to enroll? Let us know if you have any questions! 🎯`;
    reminders.push({
      type: 'TRIAL_FOLLOW_UP',
      parentName: trial.parentName,
      parentPhone: trial.parentPhone,
      studentName: trial.childName,
      message,
      waLink: waLink(trial.parentPhone, message)
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 7. 🚨 ABSENCE ALERTS — 3+ consecutive absences (care, not nagging)
  // ═══════════════════════════════════════════════════════════
  for (const st of students) {
    if (!st.parent?.phone) continue;
    let absences = 0;
    for (const a of st.attendances) {
      if (!a.isPresent) absences++;
      else break;
    }
    if (absences >= 3) {
      const sport = st.enrollments?.[0]?.batch?.sport || "training";
      const message = `Hi ${st.parent.name}! We've noticed ${st.name} hasn't been at ${sport} sessions for a few days. We miss them! Is everything alright? Feel free to reach out if there's anything we can help with. Hope to see ${st.name} back soon! 🙏`;
      reminders.push({
        type: 'ABSENT_STREAK',
        parentName: st.parent.name,
        parentPhone: st.parent.phone,
        studentName: st.name,
        message,
        waLink: waLink(st.parent.phone, message),
        metadata: { missedCount: absences }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 8. 💰 FEE DUE — Gentle reminder (capped at 5 max, not 30)
  // ═══════════════════════════════════════════════════════════
  let feeCount = 0;
  // Fee dues are money: only staff with fees.collect get these reminders.
  const canSeeFees = (await checkPermission("fees.collect")).ok;
  for (const st of students) {
    if (!canSeeFees) break;
    if (!st.parent?.phone || !st.feeRecords?.length) continue;
    if (feeCount >= 5) break;
    const fee = st.feeRecords[0];
    const message = `Hi ${st.parent.name}! Just a quick note — ${st.name}'s fee of ₹${fee.amount} for ${fee.month} is pending. You can pay at the academy front desk or online. Thank you! 🙏`;
    reminders.push({
      type: 'FEE_DUE',
      parentName: st.parent.name,
      parentPhone: st.parent.phone,
      studentName: st.name,
      message,
      waLink: waLink(st.parent.phone, message),
      metadata: { amount: fee.amount, month: fee.month }
    });
    feeCount++;
  }

  // Sort: Training > Progress > Streaks > Birthdays > Events > Trials > Absences > Fees
  const priority: Record<string, number> = {
    SESSION_TOMORROW: 1,
    PROGRESS_UPDATE: 2,
    STREAK_MILESTONE: 3,
    BIRTHDAY: 4,
    EVENT_REMINDER: 5,
    TRIAL_FOLLOW_UP: 6,
    ABSENT_STREAK: 7,
    FEE_DUE: 8,
  };
  reminders.sort((a, b) => (priority[a.type] || 99) - (priority[b.type] || 99));

  return reminders;
}

export async function markReminderSent(type: string, parentPhone: string) {
  const session = await requireAuth(['ADMIN']);
  try {
    await db.auditLog.create({
      data: {
        action: `REMINDER_SENT_${type}`,
        userId: session.id,
        orgId: session.orgId || null,
        details: JSON.stringify({ to: parentPhone, timestamp: new Date().toISOString() })
      }
    });
  } catch (e) {
    console.log(`Reminder logged: ${type} to ${parentPhone}`);
  }
}
