import type { Metadata } from "next";
import Link from "next/link";
import { CoachOsShell } from "@/components/coach/os/CoachOsShell";
import { AssessmentForm } from "@/components/coach/os/AssessmentForm";
import { AssessPicker } from "@/components/coach/os/AssessPicker";
import { loadAssessTarget, loadCoachOsContext, loadRoster } from "@/lib/coach/data";
import { RUBRICS, rubricIdFor, type RubricId } from "@/lib/skill-rubrics";

// The title never carries the athlete's name.
export const metadata: Metadata = { title: "Assess · TRIQ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CoachAssessPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) || {};
  const ctx = await loadCoachOsContext(typeof sp.scope === "string" ? sp.scope : null);
  const studentId = typeof sp.student === "string" ? sp.student : "";
  const scopeQuery = ctx.scope === "all" ? "&scope=all" : "";

  if (!studentId) {
    const { rows, currentMonth } = await loadRoster(ctx);
    return (
      <CoachOsShell section="assess" title="Assess an athlete" subtitle="Score the sport rubric, 1 to 5" scope={ctx.scope} canViewAll={ctx.canViewAll}>
        <AssessPicker rows={rows} currentMonth={currentMonth} scopeQuery={scopeQuery} />
      </CoachOsShell>
    );
  }

  const target = await loadAssessTarget(ctx, studentId);
  if (!target) {
    // Refused and missing look the same.
    return (
      <CoachOsShell section="assess" title="Assess an athlete" scope={ctx.scope} canViewAll={ctx.canViewAll}>
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="font-semibold">Athlete not found</p>
          <p className="mt-1 text-sm text-ink-muted">You can assess athletes in batches you coach.</p>
          <Link href={`/coach/assess${scopeQuery ? "?scope=all" : ""}`} className="mt-3 inline-block text-sm font-semibold underline">
            Pick an athlete
          </Link>
        </div>
      </CoachOsShell>
    );
  }

  const batchSports = [...new Set(target.batchSports.map(rubricIdFor))] as RubricId[];
  const requested = typeof sp.sport === "string" && sp.sport in RUBRICS ? (sp.sport as RubricId) : null;
  const defaultSport: RubricId = requested ?? batchSports[0] ?? "generic";

  return (
    <CoachOsShell section="assess" title="Assessment" subtitle="Score each skill from 1 to 5" scope={ctx.scope} canViewAll={ctx.canViewAll}>
      <AssessmentForm
        key={target.student.id}
        student={target.student}
        defaultSport={defaultSport}
        batchSports={batchSports}
        currentMonth={target.currentMonth}
        thisMonth={target.thisMonth}
        previous={target.previous}
      />
    </CoachOsShell>
  );
}
