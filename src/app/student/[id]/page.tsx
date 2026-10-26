import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { MedicalForm } from "@/components/org/MedicalForm";
import { PlayerAnalytics } from "@/components/analytics/PlayerAnalytics";
import { formatMoney, type OrgLocale } from "@/lib/i18n";
import { parseMedicalInfo } from "@/lib/coach";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { FEATURES } from "@/lib/features";
<<<<<<< HEAD
import { listAthleteRecords } from "@/app/actions/athlete";
import { AthletePanel } from "@/components/athlete/AthletePanel";
=======
import { canViewMedical } from "@/lib/health";
import { checkPermission } from "@/lib/membership";
>>>>>>> origin/build/v-careers-wellness-creators

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Verified session (signed cookie) — redirects to /login if missing/invalid
  const session = await requireAuth(["ADMIN", "COACH", "PARENT"]);

  // Tenant scope: admins/coaches only see students of their own academy,
  // parents only see their own children, coaches only students in their own batches.
  const orgScope = session.orgId || "__no_org__";
  const accessFilter =
    session.role === "PARENT"
      ? { parentId: session.id }
      : session.role === "COACH"
        ? { orgId: orgScope, enrollments: { some: { batch: { coachId: session.id as string, orgId: orgScope } } } }
        : { orgId: orgScope };

  const backHref = session.role === "PARENT" ? "/parent" : session.role === "COACH" ? "/coach" : "/org";

  // Load org locale for currency formatting
  const org = session.orgId
    ? await db.organization.findUnique({
        where: { id: session.orgId },
        select: { name: true, country: true, currency: true, timezone: true, locale: true, phoneCountry: true },
      })
    : null;
  const orgLocale: OrgLocale = org ?? {};

  const student = await db.student.findFirst({
    where: { id, ...accessFilter },
    include: {
      parent: true,
      enrollments: { include: { batch: { include: { coach: true } } } },
      feeRecords: { orderBy: { month: "desc" }, take: 12 },
      attendances: { orderBy: { session: { date: "desc" } }, take: 20, include: { session: true } },
      skillReports: { orderBy: { createdAt: "desc" } },
      Media: { orderBy: { createdAt: "desc" } },
      incidents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!student) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Student not found</h1>
          <a href={backHref} className="text-sky-400 hover:underline">← Back to Dashboard</a>
        </div>
      </div>
    );
  }

<<<<<<< HEAD
  // V2 athlete records (flag-gated; returns an error value instead of throwing if the SQL is not applied yet)
  const athleteRecords = FEATURES.athleteOS ? await listAthleteRecords(student.id) : null;
=======
  // V6 Wellness: with the flag on, owners/managers need health.view to see medical data.
  const hasHealthView = FEATURES.wellness && session.role === "ADMIN" ? (await checkPermission("health.view")).ok : true;
  const showMedical = canViewMedical({ wellness: FEATURES.wellness, appRole: session.role, hasHealthView });
>>>>>>> origin/build/v-careers-wellness-creators

  // Calculate attendance
  const medical = parseMedicalInfo(showMedical ? student.medicalInfo : null);
  const totalAttended = student.attendances.filter((a) => a.isPresent).length;
  const totalSessions = student.attendances.length;
  const attendancePercentage = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <a href={backHref} className="text-sky-400 hover:underline text-sm inline-block">← Back to Dashboard</a>
            {FEATURES.progressReport && (
              <Link href={`/student/${student.id}/report`} className="text-sm rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-100 hover:bg-zinc-800">
                Monthly progress report →
              </Link>
            )}
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{student.name}</h1>
                <div className="mt-2 text-zinc-400 space-y-1 text-sm">
                  <p>Parent: {student.parent?.name} ({student.parent?.phone || "No phone"})</p>
                  {student.dob && <p>DOB: {new Date(student.dob).toLocaleDateString()}</p>}
                  {showMedical && student.bloodGroup && <p>Blood Group: {student.bloodGroup}</p>}
                  {medical.hasAny && (
                    <p className={medical.severity === "alert" ? "text-rose-400" : "text-zinc-300"}>Medical: {medical.summary}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-400 mb-1">Points Balance</div>
                <div className="text-2xl font-bold text-amber-400">{student.points} pts</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Batches */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Enrolled Batches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {student.enrollments.map((e) => (
                <div key={e.id} className="p-3 bg-zinc-900/80 rounded-md border border-zinc-800">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-zinc-100">{e.batch.name}</div>
                    <Badge variant="outline" className="text-sky-400 border-sky-900/50 bg-sky-900/20">{e.batch.sport}</Badge>
                  </div>
                  <div className="text-sm text-zinc-400">
                    <p>Coach: {e.batch.coach?.name || "Unassigned"}</p>
                    <p>Schedule: {e.batch.schedule}</p>
                  </div>
                </div>
              ))}
              {student.enrollments.length === 0 && (
                <p className="text-zinc-500 text-sm">No active enrollments.</p>
              )}
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-zinc-400">Attended / Total</span>
                <span className="font-medium text-zinc-100">{totalAttended} / {totalSessions}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
                <div 
                  className="bg-emerald-500 h-2 rounded-full" 
                  style={{ width: `${attendancePercentage}%` }}
                />
              </div>
              <div className="text-sm text-zinc-400 mb-2">Recent Sessions (last 20)</div>
              <div className="flex flex-wrap gap-1">
                {student.attendances.map((a) => (
                  <div 
                    key={a.id} 
                    title={new Date(a.session.date).toLocaleDateString()}
                    className={`w-3 h-3 rounded-full ${a.isPresent ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fee History */}
        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Fee History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Month</TableHead>
                    <TableHead className="text-zinc-400">Amount</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.feeRecords.map((f) => (
                    <TableRow key={f.id} className="border-zinc-800">
                      <TableCell>{f.month}</TableCell>
                      <TableCell>{formatMoney(f.amount, orgLocale)}</TableCell>
                      <TableCell>
                        {f.status === "PAID" ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <Badge variant="emerald" className="bg-emerald-900/30 text-emerald-400 border-emerald-900/50">PAID</Badge>
                            <PaymentMethodBadge status={f.status} method={f.paymentMethod} />
                          </span>
                        ) : (
                          <Badge variant="rose" className="bg-rose-900/30 text-rose-400 border-rose-900/50">{f.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {student.feeRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-zinc-500">No fee records found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sport-specific Skill Analytics */}
          <PlayerAnalytics
            reports={student.skillReports.map((r) => ({
              month: r.month,
              technique: r.technique,
              fitness: r.fitness,
              discipline: r.discipline,
              notes: r.notes,
              sport: (r as Record<string, unknown>).sport as string | null | undefined,
              metrics: (r as Record<string, unknown>).metrics as Record<string, number> | null | undefined,
            }))}
            sport={student.enrollments[0]?.batch?.sport}
            studentName={student.name}
          />

          {/* Incidents & Media */}
          <div className="space-y-6">
            <Card className="bg-zinc-900/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Incidents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {student.incidents.map((inc) => (
                  <div key={inc.id} className="p-3 bg-zinc-900/80 rounded-md border border-zinc-800">
                    <div className="flex justify-between items-start mb-1">
                      <Badge variant="outline" className="text-rose-400 border-rose-900/50 bg-rose-900/20 text-xs">{inc.type}</Badge>
                      <span className="text-xs text-zinc-500">{new Date(inc.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-zinc-300 mt-2">{inc.description}</p>
                    <p className="text-xs text-zinc-500 mt-1">Severity: {inc.severity}</p>
                  </div>
                ))}
                {student.incidents.length === 0 && (
                  <p className="text-zinc-500 text-sm">No incidents recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Media Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {student.Media.map((m) => (
                    <li key={m.id}>
                      <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline text-sm flex items-center gap-2">
                        <span>▶</span> Video Link ({new Date(m.createdAt).toLocaleDateString()})
                      </a>
                    </li>
                  ))}
                  {student.Media.length === 0 && (
                    <p className="text-zinc-500 text-sm">No media uploaded.</p>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

<<<<<<< HEAD
        {athleteRecords && athleteRecords.success && (
          <AthletePanel
            studentId={student.id}
            academyName={org?.name ?? "academy"}
            canReview={athleteRecords.canReview}
            canVerify={athleteRecords.canVerify}
            canSetGoals={athleteRecords.canSetGoals}
            achievements={JSON.parse(JSON.stringify(athleteRecords.achievements))}
            goals={JSON.parse(JSON.stringify(athleteRecords.goals))}
          />
        )}
        {athleteRecords && !athleteRecords.success && (
          <p className="text-sm text-zinc-500">Achievements &amp; goals: {athleteRecords.error}</p>
        )}

        <div className="mt-8">
          <MedicalForm student={{ id: student.id, name: student.name, bloodGroup: student.bloodGroup }} />
        </div>
=======
        {showMedical && (
          <div className="mt-8">
            {/* medicalInfo is passed so the form starts from the saved values (it used to start blank
                and saving wiped the existing record). */}
            <MedicalForm student={{ id: student.id, name: student.name, bloodGroup: student.bloodGroup, medicalInfo: student.medicalInfo }} />
          </div>
        )}
>>>>>>> origin/build/v-careers-wellness-creators
      </div>
    </div>
  );
}
