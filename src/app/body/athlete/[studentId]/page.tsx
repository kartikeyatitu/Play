import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getBodyViewer, studentAccess } from "@/lib/body/access";
import {
  FITNESS_TESTS,
  ageBandOn,
  cohortMedian,
  formatFitnessValue,
  getFitnessTest,
  latestChange,
  personalBest,
  personalBestIds,
  seriesFor,
  type CohortResult,
} from "@/lib/body/tests";
import { deleteFitnessResult, recordFitnessResult } from "@/app/actions/body";
import { TrendChart } from "@/components/body/TrendChart";
import { BodyShell, Chip, NotEnabled, Notice, Panel, SectionTitle, dayLabel, ghostBtn, inputCls, labelCls, one, primaryBtn } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Test history | TRIQ Body", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AthleteTests({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: SP }) {
  const { studentId } = await params;
  const sp = await searchParams;
  const viewer = await getBodyViewer();
  const access = await studentAccess(viewer, studentId);
  if (!access.canView || !viewer.orgId) notFound();
  const orgId = viewer.orgId;

  const student = await db.student.findFirst({ where: { id: studentId, orgId }, select: { id: true, name: true, dob: true } });
  if (!student) notFound();
  const now = new Date();
  const back = { href: "/body/athletes", label: viewer.appRole === "PARENT" ? "Your children" : "Athletes" };

  if (!FEATURES.fitnessTests) {
    // Flag off: never touch FitnessResult.
    return (
      <BodyShell title={student.name} eyebrow="TRIQ Body · Fitness tests" back={back}>
        <NotEnabled what="Fitness test history and recording are not switched on for your academy yet." />
        <p className="mt-4 text-sm">
          <Link href="/body" className="text-volt-ink underline underline-offset-4">
            Browse the test catalogue →
          </Link>
        </p>
      </BodyShell>
    );
  }

  const rows = await db.fitnessResult.findMany({
    where: { orgId, studentId },
    orderBy: { recordedAt: "asc" },
    take: 1000,
    select: { id: true, testKey: true, value: true, unit: true, recordedAt: true, notes: true, recordedById: true },
  });
  const results = rows.map((r) => ({ ...r, value: Number(r.value) }));
  const testsWithResults = FITNESS_TESTS.filter((t) => seriesFor(results, t.key).length > 0);
  const otherProtocol = results.filter((r) => !getFitnessTest(r.testKey) || getFitnessTest(r.testKey)!.unit !== r.unit);

  // Same-test, same-protocol, same-age-band group median (staff and coaches only, at least 5 athletes).
  const cohorts = new Map<string, ReturnType<typeof cohortMedian>>();
  if (access.seeCohort && testsWithResults.length && student.dob) {
    const keys = testsWithResults.map((t) => t.key);
    const orgRows = await db.fitnessResult.findMany({
      where: { orgId, testKey: { in: keys } },
      orderBy: { recordedAt: "desc" },
      take: 5000,
      select: { id: true, studentId: true, testKey: true, value: true, unit: true, recordedAt: true },
    });
    const ids = [...new Set(orgRows.map((r) => r.studentId))];
    const dobs = new Map(
      (await db.student.findMany({ where: { id: { in: ids }, orgId }, select: { id: true, dob: true } })).map((s) => [s.id, s.dob]),
    );
    const cohortRows: CohortResult[] = orgRows.map((r) => ({
      ...r,
      value: Number(r.value),
      ageBand: ageBandOn(dobs.get(r.studentId) ?? null, r.recordedAt),
    }));
    for (const t of testsWithResults) {
      const s = seriesFor(results, t.key);
      const band = ageBandOn(student.dob, s[s.length - 1].recordedAt);
      cohorts.set(t.key, cohortMedian(cohortRows, t.key, band));
    }
  }

  const pbKey = one(sp.pb);
  const pbTest = pbKey ? getFitnessTest(pbKey) : null;
  const canDelete = (r: { recordedById: string }) => access.canRecord && (viewer.membership?.role !== "COACH" || r.recordedById === viewer.userId);

  return (
    <BodyShell title={student.name} eyebrow="TRIQ Body · Fitness tests" back={back}>
      <Notice error={one(sp.error)} saved={one(sp.saved) === "1"}>
        {pbTest ? `Saved. New personal best in ${pbTest.name}.` : "Saved."}
      </Notice>
      <p className="mt-3 text-sm text-ink-muted">
        Age band today: <strong className="text-ink">{ageBandOn(student.dob, now)}</strong>
        {!student.dob ? " (add a date of birth to the student record to see age bands)" : ""}. Each chart shows one test and one
        protocol only.
      </p>

      {access.canRecord ? (
        <>
          <SectionTitle>Record a result</SectionTitle>
          <Panel className="mt-3">
            <form action={recordFitnessResult} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="studentId" value={student.id} />
              <label className="block space-y-1 sm:col-span-2">
                <span className={labelCls}>Test</span>
                <select name="testKey" required className={inputCls} defaultValue={testsWithResults[0]?.key ?? FITNESS_TESTS[0].key}>
                  {FITNESS_TESTS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name} ({t.unit === "s" && t.key === "run_1km" ? "m:ss or seconds" : t.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className={labelCls}>Result</span>
                <input name="value" required inputMode="decimal" autoComplete="off" placeholder="e.g. 5.42" className={inputCls} />
              </label>
              <label className="block space-y-1">
                <span className={labelCls}>Test date</span>
                <input type="date" name="date" defaultValue={now.toISOString().slice(0, 10)} className={inputCls} />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className={labelCls}>Notes (optional)</span>
                <input name="notes" maxLength={300} placeholder="Conditions, surface, anything unusual" className={inputCls} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className={`${primaryBtn} w-full sm:w-auto`}>
                  Save result
                </button>
              </div>
            </form>
          </Panel>
        </>
      ) : null}

      <SectionTitle>History</SectionTitle>
      {!testsWithResults.length ? <p className="mt-3 text-sm text-ink-muted">No results recorded yet.</p> : null}
      <div className="mt-3 space-y-4">
        {testsWithResults.map((t) => {
          const s = seriesFor(results, t.key);
          const pbIds = personalBestIds(results, t.key);
          const pb = personalBest(results, t.key);
          const change = latestChange(results, t.key);
          const cohort = cohorts.get(t.key) ?? null;
          const fmt = (v: number) => formatFitnessValue(t, v);
          return (
            <Panel key={t.key}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    <Link href={`/body#${t.key}`} className="hover:underline">
                      {t.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-ink-muted">{change.text}</p>
                </div>
                {pb ? <Chip tone="good">PB {fmt(pb.value)}</Chip> : null}
              </div>
              <TrendChart
                label={t.name}
                better={t.better}
                format={fmt}
                series={s.map((r) => ({ value: r.value, label: dayLabel(r.recordedAt), pb: pbIds.has(r.id) }))}
              />
              {cohort ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Academy median for {cohort.ageBand}, same test and protocol: {fmt(cohort.median)} ({cohort.athletes} athletes). Children
                  develop at different rates; use this for context, not ranking.
                </p>
              ) : null}
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-ink-muted">All {s.length} results</summary>
                <ul className="mt-2 divide-y divide-line">
                  {s
                    .slice()
                    .reverse()
                    .map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          {dayLabel(r.recordedAt)} · <strong>{fmt(r.value)}</strong>
                          {pbIds.has(r.id) ? <span className="ml-1 text-xs text-success">PB</span> : null}
                          {r.notes ? <span className="block text-xs text-ink-subtle">{r.notes}</span> : null}
                        </span>
                        {canDelete(r) ? (
                          <form action={deleteFitnessResult}>
                            <input type="hidden" name="studentId" value={student.id} />
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className={`${ghostBtn} min-h-9 text-xs`}>
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </details>
            </Panel>
          );
        })}
      </div>

      {otherProtocol.length ? (
        <p className="mt-4 text-xs text-ink-subtle">
          {otherProtocol.length} older result{otherProtocol.length === 1 ? " was" : "s were"} recorded under a different protocol or unit and
          {otherProtocol.length === 1 ? " is" : " are"} not shown on these charts.
        </p>
      ) : null}
    </BodyShell>
  );
}
