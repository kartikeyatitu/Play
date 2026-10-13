"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function seedDemoData(inputOrgId?: string) {
  const session = await requireAuth(['ADMIN']);
  // Only ever seed into the signed-in admin's own academy (inputOrgId must match if given)
  if (!session.orgId) return { success: false, message: "Create your academy first." };
  if (inputOrgId && inputOrgId !== session.orgId) return { success: false, message: "You can only load demo data into your own academy." };
  const targetOrgId: string = session.orgId;
  const orgId = targetOrgId;

  // Demo phone numbers are derived from the org id so they never collide with (or
  // take over) real users or another academy's demo users. Existing users are only
  // reused if they already belong to this academy.
  const orgHash = Array.from(targetOrgId).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100000;
  const demoPhone = (n: number) => `5${String(orgHash).padStart(5, "0")}${String(n).padStart(4, "0")}`;
  async function getOrCreateDemoUser(n: number, data: { name: string; role: string; verified?: boolean; verificationData?: string }) {
    const phone = demoPhone(n);
    const existingUser = await db.user.findUnique({ where: { phone } });
    if (existingUser && existingUser.orgId === targetOrgId) {
      return db.user.update({ where: { id: existingUser.id }, data: { verificationData: data.verificationData ?? existingUser.verificationData } });
    }
    // Phone taken by someone outside this academy → create the demo user without a phone
    return db.user.create({ data: { ...data, orgId: targetOrgId, phone: existingUser ? null : phone } });
  }
  // Coupon codes are globally unique; suffix them per academy when needed
  async function demoCouponCode(code: string) {
    const taken = await db.coupon.findUnique({ where: { code } });
    return taken ? `${code}-${String(orgHash).padStart(5, "0")}` : code;
  }

  try {
    const existing = await db.student.count({
      where: { orgId: targetOrgId }
    });
    if (existing > 10) return { success: false, message: "Already seeded — clear data first from Settings" };

    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);
    const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 7);
    const admin = await db.user.findFirst({ where: { role: "ADMIN", orgId: targetOrgId } }) || await db.user.findFirst({ where: { id: session.id } });
    const adminId = admin?.id || session.id || "";

    // ═══ COACHES (3) ═══
    const rahulVerif = JSON.stringify({
      steps: [
        { name: 'ID Proof (Aadhar/PAN)', status: 'VERIFIED', uploadUrl: 'https://drive.google.com/file/d/sample-aadhar/view', verifiedAt: today.toISOString() },
        { name: 'Coaching Certificate', status: 'VERIFIED', uploadUrl: 'https://drive.google.com/file/d/sample-cert/view', verifiedAt: today.toISOString() },
        { name: 'Background Check', status: 'VERIFIED', uploadUrl: 'https://drive.google.com/file/d/sample-bg/view', verifiedAt: today.toISOString() },
        { name: 'Experience Proof', status: 'VERIFIED', uploadUrl: 'https://drive.google.com/file/d/sample-exp/view', verifiedAt: today.toISOString() },
        { name: 'First Aid Certification', status: 'VERIFIED', uploadUrl: 'https://drive.google.com/file/d/sample-firstaid/view', verifiedAt: today.toISOString() },
      ]
    });

    const priyaVerif = JSON.stringify({
      steps: [
        { name: 'ID Proof (Aadhar/PAN)', status: 'VERIFIED', uploadUrl: 'https://drive.google.com/file/d/sample-priya-aadhar/view', verifiedAt: today.toISOString() },
        { name: 'Coaching Certificate', status: 'VERIFIED', uploadUrl: 'https://drive.google.com/file/d/sample-priya-cert/view', verifiedAt: today.toISOString() },
        { name: 'Background Check', status: 'SUBMITTED', uploadUrl: 'https://drive.google.com/file/d/sample-priya-bg/view' },
        { name: 'Experience Proof', status: 'SUBMITTED', uploadUrl: 'https://drive.google.com/file/d/sample-priya-exp/view' },
        { name: 'First Aid Certification', status: 'PENDING' },
      ]
    });

    const anilVerif = JSON.stringify({
      steps: [
        { name: 'ID Proof (Aadhar/PAN)', status: 'SUBMITTED', uploadUrl: 'https://drive.google.com/file/d/sample-anil-id/view' },
        { name: 'Coaching Certificate', status: 'PENDING' },
        { name: 'Background Check', status: 'PENDING' },
        { name: 'Experience Proof', status: 'PENDING' },
        { name: 'First Aid Certification', status: 'PENDING' },
      ]
    });

    const coach1 = await getOrCreateDemoUser(1, { name: "Coach Rahul Sharma", role: "COACH", verified: true, verificationData: rahulVerif });
    const coach2 = await getOrCreateDemoUser(2, { name: "Coach Priya Verma", role: "COACH", verified: false, verificationData: priyaVerif });
    const coach3 = await getOrCreateDemoUser(3, { name: "Coach Anil Kapoor", role: "COACH", verified: false, verificationData: anilVerif });

    // ═══ BATCHES (6) ═══
    const batch1 = await db.batch.create({ data: { orgId,  name: "U-10 Football Stars", sport: "Football", schedule: "Mon/Wed/Fri 4:00-5:30 PM", coachId: coach1.id, monthlyFee: 2500 } });
    const batch2 = await db.batch.create({ data: { orgId,  name: "U-14 Cricket Academy", sport: "Cricket", schedule: "Tue/Thu/Sat 5:00-6:30 PM", coachId: coach2.id, monthlyFee: 2500 } });
    const batch3 = await db.batch.create({ data: { orgId,  name: "Beginners Tennis", sport: "Tennis", schedule: "Mon/Wed 3:00-4:00 PM", coachId: coach1.id, monthlyFee: 2500 } });
    const batch4 = await db.batch.create({ data: { orgId,  name: "Advanced Badminton", sport: "Badminton", schedule: "Tue/Thu 4:00-5:30 PM", coachId: coach2.id, monthlyFee: 2500 } });
    const batch5 = await db.batch.create({ data: { orgId,  name: "Swimming Basics", sport: "Swimming", schedule: "Mon/Wed/Fri 6:00-7:00 AM", coachId: coach3.id, monthlyFee: 2500 } });
    const batch6 = await db.batch.create({ data: { orgId,  name: "U-16 Basketball", sport: "Basketball", schedule: "Sat/Sun 8:00-10:00 AM", coachId: coach3.id, monthlyFee: 2500 } });
    const allBatches = [batch1, batch2, batch3, batch4, batch5, batch6];

    // ═══ PARENTS (8) ═══
    const parents = [];
    for (const p of [
      { phone: "9111111111", name: "Amit Patel" },
      { phone: "9222222222", name: "Sunita Gupta" },
      { phone: "9333333333", name: "Rajesh Kumar" },
      { phone: "9444444444", name: "Meera Singh" },
      { phone: "9555555555", name: "Vikram Reddy" },
      { phone: "9666666666", name: "Pooja Sharma" },
      { phone: "9777777777", name: "Deepak Jain" },
      { phone: "9888888888", name: "Kavita Nair" },
    ]) {
      // Org-scoped demo parent (never re-assigns an existing user from another academy)
      parents.push(await getOrCreateDemoUser(100 + parents.length, { name: p.name, role: "PARENT" }));
    }

    // ═══ STUDENTS (20) — birthday today for Arjun, 3 days from now for Karan ═══
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd3 = String(Math.min(today.getDate() + 3, 28)).padStart(2, "0");

    const studentData = [
      { name: "Arjun Patel", pi: 0, bi: 0, dob: `2015-${mm}-${dd}`, pts: 200, bg: "B+" },
      { name: "Riya Patel", pi: 0, bi: 2, dob: "2017-08-20", pts: 85, bg: "B+" },
      { name: "Karan Gupta", pi: 1, bi: 0, dob: `2014-${mm}-${dd3}`, pts: 175, bg: "A+" },
      { name: "Ananya Gupta", pi: 1, bi: 3, dob: "2012-05-18", pts: 140, bg: "O+" },
      { name: "Rohan Kumar", pi: 2, bi: 1, dob: "2013-01-25", pts: 165, bg: "A-" },
      { name: "Sneha Kumar", pi: 2, bi: 4, dob: "2016-07-10", pts: 55, bg: "AB+" },
      { name: "Aarav Singh", pi: 3, bi: 0, dob: "2015-09-08", pts: 190, bg: "O+" },
      { name: "Ishaan Singh", pi: 3, bi: 1, dob: "2013-04-12", pts: 160, bg: "O-" },
      { name: "Diya Reddy", pi: 4, bi: 3, dob: "2012-12-30", pts: 95, bg: "B-" },
      { name: "Vivaan Reddy", pi: 4, bi: 5, dob: "2014-06-22", pts: 130, bg: "A+" },
      { name: "Anika Sharma", pi: 5, bi: 2, dob: "2016-03-05", pts: 70, bg: "O+" },
      { name: "Dev Sharma", pi: 5, bi: 0, dob: "2014-11-15", pts: 145, bg: "O+" },
      { name: "Myra Jain", pi: 6, bi: 4, dob: "2015-02-28", pts: 60, bg: "A+" },
      { name: "Vihaan Jain", pi: 6, bi: 1, dob: "2013-08-14", pts: 180, bg: "B+" },
      { name: "Saanvi Nair", pi: 7, bi: 5, dob: "2014-10-02", pts: 110, bg: "AB-" },
      { name: "Advik Nair", pi: 7, bi: 3, dob: "2012-07-25", pts: 155, bg: "A-" },
      { name: "Reyansh Patel", pi: 0, bi: 5, dob: "2013-06-18", pts: 90, bg: "B+" },
      { name: "Amaira Kumar", pi: 2, bi: 2, dob: "2016-11-08", pts: 45, bg: "O+" },
      { name: "Kabir Singh", pi: 3, bi: 4, dob: "2015-01-20", pts: 75, bg: "O-" },
      { name: "Navya Reddy", pi: 4, bi: 0, dob: "2015-04-11", pts: 120, bg: "B-" },
    ];

    const students = [];
    for (const sd of studentData) {
      const s = await db.student.create({
        data: { orgId,  name: sd.name, parentId: parents[sd.pi].id, dob: new Date(sd.dob), points: sd.pts, bloodGroup: sd.bg },
      });
      await db.batchEnrollment.create({ data: {  studentId: s.id, batchId: allBatches[sd.bi].id } });
      students.push(s);
    }

    // ═══ SESSIONS (last 20 days per batch) ═══
    for (const batch of allBatches) {
      for (let i = 0; i < 20; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (d.getDay() === 0) continue;
        await db.session.create({ data: { orgId,  batchId: batch.id, date: d } });
      }
    }

    // ═══ ATTENDANCE ═══
    const sessions = await db.session.findMany({
      where: { batchId: { in: allBatches.map(b => b.id) } },
      include: { batch: { include: { enrollments: true } } }
    });
    for (const session of sessions) {
      for (const enrollment of session.batch.enrollments) {
        const si = students.findIndex(s => s.id === enrollment.studentId);
        const rate = si < 5 ? 0.9 : si < 10 ? 0.75 : si < 15 ? 0.6 : 0.5;
        await db.attendance.create({ data: {  sessionId: session.id, studentId: enrollment.studentId, isPresent: Math.random() < rate } });
      }
    }

    // ═══ FEE RECORDS (3 months) ═══
    for (const s of students) {
      await db.feeRecord.create({ data: { orgId,  studentId: s.id, amount: 2500, month: twoMonthsAgo, status: "PAID" } });
      await db.feeRecord.create({ data: { orgId,  studentId: s.id, amount: 2500, month: lastMonth, status: Math.random() > 0.15 ? "PAID" : "PENDING" } });
      await db.feeRecord.create({ data: { orgId,  studentId: s.id, amount: 2500, month: currentMonth, status: Math.random() > 0.5 ? "PAID" : "PENDING" } });
    }

    // ═══ SKILL REPORTS ═══
    const notes = ["Great improvement!", "Needs consistency", "Excellent team player", "Natural talent", "Keep working hard", "Outstanding discipline", "Improving steadily", "Focus on technique"];
    for (const s of students) {
      await db.skillReport.create({
        data: { orgId,  studentId: s.id, coachId: [coach1, coach2, coach3][Math.floor(Math.random() * 3)].id, month: currentMonth, technique: Math.floor(Math.random() * 3) + 3, fitness: Math.floor(Math.random() * 3) + 3, discipline: Math.floor(Math.random() * 3) + 3, notes: notes[Math.floor(Math.random() * notes.length)] },
      });
    }

    // ═══ ANNOUNCEMENTS (5) ═══
    const aid = adminId || coach1.id;
    await db.announcement.create({ data: { orgId,  title: "🏆 Annual Sports Day", message: "Join us December 15th! All students participate. Refreshments provided.", authorId: aid } });
    await db.announcement.create({ data: { orgId,  title: "💰 Fee Reminder", message: "Clear pending fees before 10th to avoid late charges. UPI accepted.", authorId: aid } });
    await db.announcement.create({ data: { orgId,  title: "🏊 New Swimming Batch", message: "Swimming batch starting! Limited to 10 students. Register now.", authorId: aid } });
    await db.announcement.create({ data: { orgId,  title: "🌧️ Rainy Day Policy", message: "Heavy rain = outdoor sessions cancelled. Indoor activities continue.", authorId: aid } });
    await db.announcement.create({ data: { orgId,  title: "📸 Photo Day Next Week", message: "Professional photographer coming Tuesday. Wear academy uniforms.", authorId: aid } });

    // ═══ PRODUCTS (5) + ORDERS (3) ═══
    const prod1 = await db.product.create({ data: { orgId,  name: "Academy T-Shirt", description: "Official academy jersey. S/M/L/XL.", price: 599, stock: 50 } });
    const prod2 = await db.product.create({ data: { orgId,  name: "Training Kit Bag", description: "Durable bag with academy logo.", price: 899, stock: 30 } });
    const prod3 = await db.product.create({ data: { orgId,  name: "Water Bottle 750ml", description: "BPA-free sports bottle.", price: 299, stock: 100 } });
    await db.product.create({ data: { orgId,  name: "Cricket Bat (Junior)", description: "Kashmir willow, size 4-5.", price: 1499, stock: 15 } });
    await db.product.create({ data: { orgId,  name: "Football (Match)", description: "FIFA-approved size 5.", price: 799, stock: 25 } });

    // Order model uses studentId not userId
    await db.order.create({ data: { orgId,  productId: prod1.id, studentId: students[0].id, status: "DELIVERED" } });
    await db.order.create({ data: { orgId,  productId: prod2.id, studentId: students[2].id, status: "PENDING" } });
    await db.order.create({ data: { orgId,  productId: prod3.id, studentId: students[5].id, status: "PENDING" } });

    // ═══ EVENTS (4) + RSVPs ═══
    const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMo = new Date(today); nextMo.setMonth(nextMo.getMonth() + 1);

    const evt1 = await db.event.create({ data: { orgId,  title: "Inter-Academy Football Match", date: nextWeek, location: "DLF Phase 5 Ground", batchId: batch1.id } });
    const evt2 = await db.event.create({ data: { orgId,  title: "Cricket Tournament", date: nextMo, location: "Tau Devi Lal Stadium", batchId: batch2.id } });
    await db.event.create({ data: { orgId,  title: "Swimming Gala", date: new Date(today.getTime() + 14 * 86400000), location: "Sector 42 Pool", batchId: batch5.id } });
    await db.event.create({ data: { orgId,  title: "Annual Day Celebration", date: new Date(today.getFullYear(), 11, 25), location: "Academy Main Hall", batchId: batch1.id } });

    // RSVP uses studentId (not userId)
    for (let i = 0; i < 5; i++) {
      await db.rSVP.create({ data: { orgId,  eventId: evt1.id, studentId: students[i].id, status: Math.random() > 0.3 ? "GOING" : "PENDING" } });
    }
    for (let i = 4; i < 8; i++) {
      await db.rSVP.create({ data: { orgId,  eventId: evt2.id, studentId: students[i].id, status: Math.random() > 0.2 ? "GOING" : "NOT_GOING" } });
    }

    // ═══ MESSAGES ═══
    if (adminId) {
      const msgs = [
        { from: parents[0].id, to: adminId, content: "When is the next football match scheduled?" },
        { from: adminId, to: parents[0].id, content: "Hi Amit! Inter-academy match is on " + nextWeek.toLocaleDateString() + ". Arjun is in the starting lineup! 🏆" },
        { from: parents[1].id, to: adminId, content: "Can Ananya switch from Badminton to Tennis?" },
        { from: adminId, to: parents[1].id, content: "Sure Sunita! I'll transfer Ananya to Tennis from next week." },
        { from: parents[2].id, to: adminId, content: "Rohan won't attend this week due to exams." },
        { from: parents[3].id, to: adminId, content: "Is there a sibling discount for both kids?" },
        { from: adminId, to: parents[3].id, content: "Yes Meera! 15% sibling discount. I'll apply SIBLING15 to your next bill." },
      ];
      for (const m of msgs) await db.message.create({ data: { orgId,  senderId: m.from, receiverId: m.to, content: m.content } });
    }

    // ═══ FACILITIES (3) ═══
    await db.facility.create({ data: { orgId,  name: "Main Football Ground", type: "OUTDOOR" } });
    await db.facility.create({ data: { orgId,  name: "Indoor Badminton Court", type: "INDOOR" } });
    await db.facility.create({ data: { orgId,  name: "Swimming Pool (25m)", type: "OUTDOOR" } });

    // ═══ EQUIPMENT (5) ═══
    await db.equipment.create({ data: { orgId,  name: "Football (Nike)", quantity: 15 } });
    await db.equipment.create({ data: { orgId,  name: "Cricket Stumps Set", quantity: 4 } });
    await db.equipment.create({ data: { orgId,  name: "Badminton Rackets", quantity: 20 } });
    await db.equipment.create({ data: { orgId,  name: "Training Cones (50)", quantity: 50 } });
    await db.equipment.create({ data: { orgId,  name: "First Aid Kit", quantity: 3 } });

    // ═══ TRIAL BOOKINGS (3) ═══
    const td = new Date(today); td.setDate(td.getDate() + 3);
    await db.trialBooking.create({ data: { childName: "Aryan Mehta", parentName: "Pradeep Mehta", parentPhone: "9100000001", childAge: 9, batchId: batch1.id, date: td, status: "CONFIRMED" } });
    await db.trialBooking.create({ data: { childName: "Zara Khan", parentName: "Salman Khan", parentPhone: "9100000002", childAge: 7, batchId: batch5.id, date: td, status: "PENDING" } });
    await db.trialBooking.create({ data: { childName: "Om Agarwal", parentName: "Neha Agarwal", parentPhone: "9100000003", childAge: 11, batchId: batch2.id, date: new Date(today.getTime() + 5 * 86400000), status: "CONFIRMED" } });

    // ═══ LEADS (CRM PIPELINE) ═══
    const leadsData = [
      { parentName: "Praveen Nair", parentPhone: "9820011223", childName: "Rudra Nair", childAge: 8, sport: "Cricket", source: "WEBSITE", status: "NEW", notes: "Interested in weekend morning batches." },
      { parentName: "Shruti Desai", parentPhone: "9820033445", childName: "Aadhya Desai", childAge: 10, sport: "Football", source: "WALK_IN", status: "CONTACTED", notes: "Discussed batch timing, parent requested demo video." },
      { parentName: "Pradeep Mehta", parentPhone: "9100000001", childName: "Aryan Mehta", childAge: 9, sport: "Football", source: "WEBSITE", status: "TRIAL_BOOKED", notes: "Trial confirmed for upcoming session." },
      { parentName: "Vikram Malhotra", parentPhone: "9820055667", childName: "Samar Malhotra", childAge: 12, sport: "Badminton", source: "REFERRAL", status: "TRIAL_ATTENDED", notes: "Attended trial on Tuesday. Coach gave positive feedback. Ready to enroll!" },
      { parentName: "Gaurav Sen", parentPhone: "9820077889", childName: "Dev Sen", childAge: 11, sport: "Swimming", source: "INSTAGRAM", status: "ENROLLED", notes: "Enrolled in Swimming Basics with Monthly Plan." },
      { parentName: "Bhavna Pillai", parentPhone: "9820099001", childName: "Tara Pillai", childAge: 7, sport: "Tennis", source: "GOOGLE", status: "LOST", notes: "Timing conflicted with school bus schedule." },
    ];
    for (const ld of leadsData) {
      await db.lead.create({
        data: {
          orgId,
          ...ld,
          followUpDate: new Date(today.getTime() + 2 * 86400000),
        }
      });
    }

    // ═══ REFERRALS (2) ═══
    await db.referral.create({ data: { referrerId: parents[0].id, refereePhone: "9100000001", status: "CONVERTED", discount: 500 } });
    await db.referral.create({ data: { referrerId: parents[3].id, refereePhone: "9100000002", status: "PENDING", discount: 500 } });

    // ═══ HOLIDAYS (4) ═══
    await db.holiday.create({ data: { orgId, title: "Diwali", date: new Date(today.getFullYear(), 9, 20) } });
    await db.holiday.create({ data: { orgId, title: "Christmas", date: new Date(today.getFullYear(), 11, 25) } });
    await db.holiday.create({ data: { orgId, title: "Republic Day", date: new Date(today.getFullYear() + 1, 0, 26) } });
    await db.holiday.create({ data: { orgId, title: "Holi", date: new Date(today.getFullYear() + 1, 2, 14) } });

    // ═══ WAITLIST (3) ═══
    await db.waitlist.create({ data: { orgId,  batchId: batch1.id, parentName: "Akash Verma", parentPhone: "9100000010", childName: "Rishi Verma" } });
    await db.waitlist.create({ data: { orgId,  batchId: batch5.id, parentName: "Neelam Chopra", parentPhone: "9100000011", childName: "Siya Chopra" } });
    await db.waitlist.create({ data: { orgId,  batchId: batch2.id, parentName: "Rohit Bansal", parentPhone: "9100000012", childName: "Laksh Bansal" } });

    // ═══ FEEDBACK (4) ═══
    await db.feedback.create({ data: { orgId,  parentId: parents[0].id, rating: 5, comment: "Arjun loves football sessions! Coach Rahul is amazing. Highly recommend!" } });
    await db.feedback.create({ data: { orgId,  parentId: parents[1].id, rating: 4, comment: "Good coaching but wish timings were more flexible." } });
    await db.feedback.create({ data: { orgId,  parentId: parents[3].id, rating: 5, comment: "Both kids are thriving here. Sibling discount is a great touch!" } });
    await db.feedback.create({ data: { orgId,  parentId: parents[4].id, rating: 3, comment: "Facilities are decent but changing rooms need improvement." } });

    // ═══ COUPONS (3) ═══
    await db.coupon.create({ data: { orgId,  code: await demoCouponCode("WELCOME20"), discount: 20, type: "PERCENT", isActive: true, usageLimit: 100 } });
    await db.coupon.create({ data: { orgId,  code: await demoCouponCode("SIBLING15"), discount: 15, type: "PERCENT", isActive: true, usageLimit: 50 } });
    await db.coupon.create({ data: { orgId,  code: await demoCouponCode("DIWALI500"), discount: 500, type: "FLAT", isActive: true, usageLimit: 30 } });

    // ═══ TRANSPORT ROUTES (2) ═══
    await db.transportRoute.create({ data: { orgId,  name: "Route A - Sector 14 → Academy", driverName: "Ramesh Yadav", driverPhone: "9100000020", vehicleNumber: "HR-26-AB-1234", stops: JSON.stringify(["Sector 14", "Sector 21", "Sector 28", "Academy Gate"]), studentNames: JSON.stringify(["Arjun Patel", "Karan Gupta"]) } });
    await db.transportRoute.create({ data: { orgId,  name: "Route B - DLF Phase → Academy", driverName: "Suresh Kumar", driverPhone: "9100000021", vehicleNumber: "HR-26-CD-5678", stops: JSON.stringify(["DLF Phase 1", "Phase 3", "Cyber City", "Academy Gate"]), studentNames: JSON.stringify(["Aarav Singh", "Ishaan Singh"]) } });

    // ═══ FEE PLANS (3) ═══
    await db.feePlan.create({ data: { orgId,  name: "Monthly Plan", duration: 1, amount: 2500, sport: "All Sports", isActive: true } });
    await db.feePlan.create({ data: { orgId,  name: "Quarterly Plan (Save 10%)", duration: 3, amount: 6750, sport: "All Sports", isActive: true } });
    await db.feePlan.create({ data: { orgId,  name: "Annual Plan (Save 20%)", duration: 12, amount: 24000, sport: "All Sports", isActive: true } });

    // ═══ AUDIT LOG (5) ═══
    if (adminId) {
      for (const entry of [
        { action: "STUDENT_ADDED", details: "Added Arjun Patel to U-10 Football Stars" },
        { action: "FEE_COLLECTED", details: "Collected ₹2,500 from Amit Patel for Oct 2026" },
        { action: "BATCH_CREATED", details: "Created Swimming Basics batch" },
        { action: "COACH_VERIFIED", details: "Verified Coach Rahul Sharma" },
        { action: "COUPON_CREATED", details: "Created WELCOME20 coupon (20% off)" },
      ]) {
        await db.auditLog.create({ data: { orgId,  userId: adminId, action: entry.action, details: entry.details } });
      }
    }

    // ═══ INCIDENTS (2) ═══
    await db.incident.create({ data: { orgId,  studentId: students[4].id, coachId: coach2.id, type: "INJURY", description: "Minor knee scrape during cricket. First aid applied. Parent informed.", severity: "LOW" } });
    await db.incident.create({ data: { orgId,  studentId: students[0].id, coachId: coach1.id, type: "MISCONDUCT", description: "Argument with teammate during football. Resolved on-field.", severity: "LOW" } });

    // ═══ GALLERY PHOTOS (3) ═══
    if (adminId) {
      await db.galleryPhoto.create({ data: { orgId,  url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400", caption: "Football training session 🏟️", uploadedById: adminId } });
      await db.galleryPhoto.create({ data: { orgId,  url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=400", caption: "Cricket practice in action 🏏", uploadedById: adminId } });
      await db.galleryPhoto.create({ data: { orgId,  url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400", caption: "Swimming batch ready 🏊", uploadedById: adminId } });
    }

    revalidatePath("/org");
    revalidatePath("/parent");
    revalidatePath("/coach");
    return { success: true, message: "🎉 Seeded: 20 students, 8 parents, 3 coaches, 6 batches, sessions, attendance, fees, reports, announcements, products, orders, events, RSVPs, messages, facilities, equipment, trials, referrals, holidays, waitlist, feedback, coupons, transport, fee plans, audit logs, incidents, gallery photos" };
  } catch (e: any) {
    console.error("Seed error:", e);
    return { success: false, message: e?.message || "Seeding failed" };
  }
}
