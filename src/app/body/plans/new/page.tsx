import type { Metadata } from "next";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { canPlan, getBodyViewer, plannableBatches } from "@/lib/body/access";
import { DEFAULT_SESSION_MINUTES } from "@/lib/body/plans";
import { PlanBuilder } from "@/components/body/PlanBuilder";
import { BodyShell, NotEnabled, Notice, one } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New session plan | TRIQ Body", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NewPlanPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const viewer = await getBodyViewer();
  const back = { href: "/body/plans", label: "Session plans" };
  if (!canPlan(viewer) || !viewer.orgId) {
    return (
      <BodyShell title="New session plan" back={back}>
        <p className="mt-6 text-sm text-ink-muted">Session plans are for the academy's coaches and managers.</p>
      </BodyShell>
    );
  }
  const batches = await plannableBatches(viewer);
  const customDrills = FEATURES.drillLibrary
    ? await db.drill.findMany({
        where: { orgId: viewer.orgId, archivedAt: null },
        select: { id: true, sport: true, title: true, durationMin: true },
        orderBy: { title: "asc" },
        take: 300,
      })
    : [];

  return (
    <BodyShell title="New session plan" back={back}>
      <Notice error={one(sp.error)} />
      {!FEATURES.drillLibrary ? <NotEnabled what="Saving session plans is not switched on yet. Build the plan here and print it." /> : null}
      <PlanBuilder
        enabled={FEATURES.drillLibrary}
        batches={batches}
        customDrills={customDrills}
        initial={{ title: "", batchId: batches[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), sessionMinutes: DEFAULT_SESSION_MINUTES, notes: "", sport: batches[0]?.sport ?? "", items: [] }}
      />
    </BodyShell>
  );
}
