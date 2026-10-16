UPDATE "Batch" SET "coachId" = (SELECT id FROM "User" WHERE phone='9000000003') WHERE name='Advanced Badminton';
DELETE FROM "StaffPayout"; DELETE FROM "Expense";
DELETE FROM "StaffAttendance" WHERE "membershipId" IN (SELECT m.id FROM "OrgMembership" m JOIN "User" u ON u.id=m."userId" WHERE u.phone='9000000002');
INSERT INTO "StaffAttendance" (id,"membershipId","orgId",date,status,"updatedAt")
SELECT 'sa_'||d::date, m.id, m."orgId", (d::date)::timestamp,
  CASE WHEN extract(day from d) IN (6,9) THEN 'ABSENT' WHEN extract(day from d)=12 THEN 'HALF_DAY' ELSE 'PRESENT' END, now()
FROM generate_series('2026-10-01'::date,'2026-10-13'::date,'1 day') d,
     "OrgMembership" m JOIN "User" u ON u.id=m."userId" JOIN "Organization" o ON o.id=m."orgId"
WHERE u.phone='9000000002' AND o.name='Ace Sports Academy';
