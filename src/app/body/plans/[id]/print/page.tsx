import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { getBodyViewer } from "@/lib/body/access";
import { loadPlanForViewer } from "@/lib/body/plan-load";
import { checkPlanTime } from "@/lib/body/plans";
import { sportLabel } from "@/lib/body/drills";
import { PrintButton } from "@/components/body/PrintButton";
import { BodyShell, NotEnabled, dayLabel } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print session plan | TRIQ Body", robots: { index: false, follow: false } };

export default async function PrintPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!FEATURES.drillLibrary) {
    return (
      <BodyShell title="Session plan" back={{ href: "/body/plans", label: "Session plans" }}>
        <NotEnabled what="Saved session plans are not switched on yet." />
      </BodyShell>
    );
  }
  const viewer = await getBodyViewer();
  const loaded = await loadPlanForViewer(viewer, id);
  if (!loaded) notFound();
  const { plan, batch, sessionMinutes, notesText } = loaded;
  const time = checkPlanTime(plan.items, sessionMinutes);
  let clock = 0;

  return (
    <BodyShell
      title={plan.title}
      eyebrow={`Session plan · ${sportLabel(plan.sport)}`}
      back={{ href: `/body/plans/${plan.id}`, label: "Edit plan" }}
      actions={<PrintButton />}
    >
      <p className="mt-2 text-sm text-ink-muted">
        {plan.date ? dayLabel(plan.date) : "No date"} · {batch?.name ?? "No batch"} · {sessionMinutes} min session · {time.total} min planned
      </p>
      {notesText ? <p className="mt-2 text-sm">{notesText}</p> : null}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            <th className="py-2 pr-2 font-medium">Time</th>
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 text-right font-medium">Min</th>
          </tr>
        </thead>
        <tbody>
          {plan.items.map((i) => {
            const start = clock;
            clock += i.durationMin ?? 0;
            return (
              <tr key={i.id} className="border-b border-line align-top">
                <td className="py-2 pr-2 tabular-nums text-ink-muted">{start}′</td>
                <td className="py-2 pr-2">
                  <span className="font-medium">{i.title}</span>
                  {i.notes ? <span className="block text-xs text-ink-muted">{i.notes}</span> : null}
                </td>
                <td className="py-2 text-right tabular-nums">{i.durationMin ?? "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-sm">{time.text}</p>
    </BodyShell>
  );
}
