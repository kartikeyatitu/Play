import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { canManageAllPlans, canPlan, getBodyViewer, plannableBatches } from "@/lib/body/access";
import { parsePlanNotes, totalMinutes } from "@/lib/body/plans";
import { copyLastWeekPlan, deleteSessionPlan } from "@/app/actions/body";
import { BodyNav, BodyShell, Chip, NotEnabled, Notice, Panel, SectionTitle, dayLabel, ghostBtn, inputCls, labelCls, one, primaryBtn } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Session plans | TRIQ Body", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PlansPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const viewer = await getBodyViewer();
  const mayPlan = canPlan(viewer);

  if (!mayPlan || !viewer.orgId) {
    return (
      <BodyShell title="Session plans">
        <BodyNav current="plans" />
        <p className="mt-6 text-sm text-ink-muted">Session plans are for the academy's coaches and managers.</p>
      </BodyShell>
    );
  }
  const orgId = viewer.orgId;
  const batches = await plannableBatches(viewer);
  const batchName = new Map(batches.map((b) => [b.id, b.name]));

  const plans = FEATURES.drillLibrary
    ? await db.sessionPlan.findMany({
        where: canManageAllPlans(viewer)
          ? { orgId }
          : { orgId, OR: [{ batchId: { in: batches.map((b) => b.id) } }, { batchId: null, createdById: viewer.userId }] },
        orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
        take: 100,
        select: { id: true, title: true, date: true, batchId: true, notes: true, items: { select: { durationMin: true } } },
      })
    : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <BodyShell
      title="Session plans"
      actions={
        <Link href="/body/plans/new" className={primaryBtn}>
          New plan
        </Link>
      }
    >
      <BodyNav current="plans" />
      <Notice error={one(sp.error)} saved={one(sp.saved) === "1"} />
      {!FEATURES.drillLibrary ? (
        <NotEnabled what="Saving session plans is not switched on yet. You can still build a plan and print it." />
      ) : (
        <>
          {batches.length ? (
            <>
              <SectionTitle>Copy last week's plan</SectionTitle>
              <Panel className="mt-3">
                <form action={copyLastWeekPlan} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <label className="block space-y-1">
                    <span className={labelCls}>Batch</span>
                    <select name="batchId" required className={inputCls}>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className={labelCls}>Plan for</span>
                    <input type="date" name="date" required defaultValue={today} className={inputCls} />
                  </label>
                  <button type="submit" className={ghostBtn}>
                    Copy
                  </button>
                </form>
                <p className="mt-2 text-xs text-ink-subtle">Copies the plan from the same weekday last week, or the latest plan in the 7 days before.</p>
              </Panel>
            </>
          ) : null}

          <SectionTitle>Plans</SectionTitle>
          {!plans.length ? <p className="mt-3 text-sm text-ink-muted">No plans yet.</p> : null}
          <ul className="mt-3 space-y-2">
            {plans.map((p) => {
              const { sessionMinutes } = parsePlanNotes(p.notes);
              const total = totalMinutes(p.items);
              return (
                <li key={p.id}>
                  <Panel>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link href={`/body/plans/${p.id}`} className="min-w-0 font-semibold hover:underline">
                        {p.title}
                      </Link>
                      <Chip tone={total > sessionMinutes ? "plain" : "good"}>
                        {total}/{sessionMinutes} min
                      </Chip>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {p.date ? dayLabel(p.date) : "No date"} · {p.batchId ? batchName.get(p.batchId) ?? "Batch" : "No batch"} · {p.items.length} items
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href={`/body/plans/${p.id}/print`} className={`${ghostBtn} min-h-9 text-xs`}>
                        Print
                      </Link>
                      <form action={deleteSessionPlan}>
                        <input type="hidden" name="planId" value={p.id} />
                        <button type="submit" className={`${ghostBtn} min-h-9 text-xs`}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </BodyShell>
  );
}
