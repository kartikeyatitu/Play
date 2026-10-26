import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { studentAccessFilter } from "@/lib/athlete-access";
import { orgCurrentMonth, orgToday, waLink, type OrgLocale } from "@/lib/i18n";
import { getAppUrl } from "@/lib/app-url";
import {
  buildMonthlyProgressReport,
  monthLabel,
  monthWindow,
  previousMonth,
  progressReportShareText,
  resolveReportMonth,
} from "@/lib/progress-report";
import { ReportActions } from "@/components/athlete/ReportActions";

export const dynamic = "force-dynamic";

export default async function MonthlyProgressReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  if (!FEATURES.progressReport) notFound();
  const { id } = await params;
  const { month: requested } = await searchParams;
  const session = await requireAuth(["ADMIN", "COACH", "PARENT"]);

  const org = session.orgId
    ? await db.organization.findUnique({
        where: { id: session.orgId },
        select: { name: true, country: true, currency: true, timezone: true, locale: true, phoneCountry: true },
      })
    : null;
  const orgLocale: OrgLocale = org ?? {};
  const currentMonth = orgCurrentMonth(orgLocale);
  const month = resolveReportMonth(requested, currentMonth);

  // Only what the report shows: no medical data, DOB, blood group or fees.
  const student = await db.student.findFirst({
    where: { id, ...studentAccessFilter(session) },
    select: {
      id: true,
      name: true,
      parent: { select: { name: true, phone: true } },
      enrollments: {
        select: { batchId: true, joinedAt: true, batch: { select: { name: true, sport: true, coach: { select: { name: true } } } } },
      },
    },
  });
  if (!student) notFound();

  const { start, end } = monthWindow(month);
  const batchIds = student.enrollments.map((e) => e.batchId);
  const [sessions, skillReports] = await Promise.all([
    batchIds.length
      ? db.session.findMany({
          where: { batchId: { in: batchIds }, date: { gte: start, lt: end } },
          select: { id: true, date: true, status: true, batchId: true },
        })
      : Promise.resolve([]),
    db.skillReport.findMany({
      where: { studentId: student.id, month: { lte: month } },
      orderBy: { month: "desc" },
      take: 6,
      select: {
        month: true, technique: true, fitness: true, discipline: true, notes: true, sport: true, metrics: true,
        coach: { select: { name: true } },
      },
    }),
  ]);
  const attendances = sessions.length
    ? await db.attendance.findMany({
        where: { studentId: student.id, sessionId: { in: sessions.map((s) => s.id) } },
        select: { sessionId: true, isPresent: true, status: true },
      })
    : [];

  const report = buildMonthlyProgressReport({
    month,
    now: new Date(`${orgToday(orgLocale)}T00:00:00.000Z`), // the org's calendar day, same encoding as Session.date
    sessions,
    attendances,
    enrollments: student.enrollments,
    skillReports: skillReports.map((r) => ({ ...r, coachName: r.coach?.name ?? null })),
    sport: student.enrollments[0]?.batch.sport ?? null,
  });

  const label = monthLabel(month, orgLocale.locale || "en-IN");
  const reportUrl = `${getAppUrl()}/student/${student.id}/report?month=${month}`;
  const shareText = progressReportShareText(report, {
    studentName: student.name,
    academyName: org?.name,
    monthLabel: label,
    link: reportUrl,
  });
  // Staff send to the parent's WhatsApp; parents share with family (no recipient).
  const whatsappHref =
    session.role !== "PARENT" && student.parent?.phone
      ? waLink(student.parent.phone, shareText, orgLocale)
      : `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const prev = previousMonth(month);
  const next = month < currentMonth ? nextMonthOf(month) : null;
  const a = report.attendance;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 print:bg-white">
      <div className="mx-auto max-w-3xl px-4 py-6 print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/student/${student.id}`} className="text-sm text-sky-700 hover:underline">
            ← Back to profile
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`?month=${prev}`} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50">
              ← {monthLabel(prev, orgLocale.locale || "en-IN")}
            </Link>
            {next && (
              <Link href={`?month=${next}`} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50">
                {monthLabel(next, orgLocale.locale || "en-IN")} →
              </Link>
            )}
          </div>
        </div>

        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{org?.name ?? "Academy"} · Monthly progress report</p>
              <h1 className="mt-1 text-2xl font-bold">{student.name}</h1>
              <p className="mt-1 text-sm text-zinc-600">
                {student.enrollments.map((e) => `${e.batch.name} (${e.batch.sport})`).join(" · ") || "Not enrolled in a batch"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{label}</p>
              {report.coachName && <p className="text-sm text-zinc-600">Assessed by {report.coachName}</p>}
            </div>
          </header>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Attendance</h2>
            {a.held === 0 ? (
              <p className="mt-2 text-sm text-zinc-600">No sessions were held for {student.name.split(" ")[0]}&apos;s batches this month.</p>
            ) : (
              <>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-4xl font-bold tabular-nums">{a.pct}%</span>
                  <span className="text-sm text-zinc-600">
                    attended {a.present + a.late} of {a.held} sessions held
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                  <Stat label="Present" value={a.present} />
                  <Stat label="Late" value={a.late} />
                  <Stat label="Absent" value={a.absent} />
                  <Stat label="Excused" value={a.excused} />
                  <Stat label="Not marked" value={a.unmarked} />
                </dl>
                {a.unmarked > 0 && (
                  <p className="mt-2 text-xs text-zinc-500">Sessions without a mark are not counted as absences.</p>
                )}
              </>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Coach assessment</h2>
            {report.skills && report.skills.length > 0 ? (
              <>
                <p className="mt-2 text-sm text-zinc-600">
                  Overall <strong className="text-zinc-900">{report.average}/5</strong>
                  {report.previousAverage !== null && <> · previous assessment {report.previousAverage}/5</>}
                </p>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-zinc-500">
                      <th className="py-2 font-medium">Skill</th>
                      <th className="py-2 font-medium">Rating</th>
                      <th className="py-2 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.skills.map((s) => (
                      <tr key={s.key} className="border-b border-zinc-100">
                        <td className="py-2">{s.label}</td>
                        <td className="py-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block h-2 w-24 rounded-full bg-zinc-200 print:border print:border-zinc-300">
                              <span className="block h-2 rounded-full bg-emerald-600" style={{ width: `${(Math.min(5, Math.max(0, s.value)) / 5) * 100}%` }} />
                            </span>
                            <span className="tabular-nums">{s.value}/5</span>
                          </span>
                        </td>
                        <td className={`py-2 text-right tabular-nums ${s.delta && s.delta > 0 ? "text-emerald-700" : s.delta && s.delta < 0 ? "text-rose-700" : "text-zinc-500"}`}>
                          {s.delta === null ? "—" : s.delta > 0 ? `+${s.delta}` : s.delta === 0 ? "no change" : s.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">The coach has not submitted an evaluation for this month yet.</p>
            )}
          </section>

          {report.coachNotes && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Coach&apos;s note</h2>
              <blockquote className="mt-2 whitespace-pre-wrap border-l-4 border-emerald-600 pl-4 text-sm italic text-zinc-800">
                {report.coachNotes}
              </blockquote>
            </section>
          )}

          <footer className="mt-10 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
            Built from attendance and coach evaluations recorded at {org?.name ?? "the academy"}. Private to the athlete&apos;s family and academy staff.
          </footer>
        </article>

        <div className="mt-4 print:hidden">
          <ReportActions whatsappHref={whatsappHref} toParent={session.role !== "PARENT" && !!student.parent?.phone} />
        </div>
      </div>
    </div>
  );
}

function nextMonthOf(month: string): string {
  const { end } = monthWindow(month);
  return end.toISOString().slice(0, 7);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
