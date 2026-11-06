import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getBodyViewer, plannableBatches } from "@/lib/body/access";
import { loadPlanForViewer } from "@/lib/body/plan-load";
import { PlanBuilder } from "@/components/body/PlanBuilder";
import { BodyShell, NotEnabled, Notice, ghostBtn, one } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Session plan | TRIQ Body", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const back = { href: "/body/plans", label: "Session plans" };
  if (!FEATURES.drillLibrary) {
    return (
      <BodyShell title="Session plan" back={back}>
        <NotEnabled what="Saved session plans are not switched on yet." />
      </BodyShell>
    );
  }
  const viewer = await getBodyViewer();
  const loaded = await loadPlanForViewer(viewer, id);
  if (!loaded || !viewer.orgId) notFound();
  const { plan, sessionMinutes, notesText } = loaded;
  const [batches, customDrills] = await Promise.all([
    plannableBatches(viewer),
    db.drill.findMany({ where: { orgId: viewer.orgId, archivedAt: null }, select: { id: true, sport: true, title: true, durationMin: true }, orderBy: { title: "asc" }, take: 300 }),
  ]);

  return (
    <BodyShell
      title={plan.title}
      back={back}
      actions={
        <Link href={`/body/plans/${plan.id}/print`} className={ghostBtn}>
          Printable view
        </Link>
      }
    >
      <Notice error={one(sp.error)} saved={one(sp.saved) === "1"} />
      <PlanBuilder
        key={plan.updatedAt.toISOString()}
        enabled
        planId={plan.id}
        batches={batches}
        customDrills={customDrills}
        initial={{
          title: plan.title,
          batchId: plan.batchId ?? "",
          date: plan.date ? plan.date.toISOString().slice(0, 10) : "",
          sessionMinutes,
          notes: notesText,
          sport: plan.sport,
          items: plan.items.map((i) => ({ drillId: i.drillId, libraryKey: null, title: i.title ?? "Item", durationMin: i.durationMin ?? 5, notes: i.notes ?? "" })),
        }}
      />
    </BodyShell>
  );
}
