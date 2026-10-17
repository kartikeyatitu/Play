-- Today-screen fixtures: a session today for "Advanced Badminton" with the first two students absent.
DELETE FROM "Attendance" WHERE "sessionId" IN (SELECT s.id FROM "Session" s JOIN "Batch" b ON b.id=s."batchId" WHERE b.name='Advanced Badminton' AND s.date = (current_date)::timestamp);
INSERT INTO "Session"(id,"batchId",date,status,"createdAt")
SELECT 'ses_today_' || to_char(current_date,'YYYYMMDD'), b.id, (current_date)::timestamp, 'COMPLETED', now() FROM "Batch" b WHERE b.name='Advanced Badminton'
ON CONFLICT ("batchId",date) DO NOTHING;
INSERT INTO "Attendance"(id,"sessionId","studentId","isPresent")
SELECT 'att_' || to_char(current_date,'YYYYMMDD') || '_' || st.id, s.id, st.id, (row_number() over (order by st.id)) > 2
FROM "Session" s JOIN "Batch" b ON b.id=s."batchId" JOIN "BatchEnrollment" e ON e."batchId"=b.id JOIN "Student" st ON st.id=e."studentId"
WHERE b.name='Advanced Badminton' AND s.date=(current_date)::timestamp
ON CONFLICT DO NOTHING;
