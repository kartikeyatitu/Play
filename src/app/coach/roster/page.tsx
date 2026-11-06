import type { Metadata } from "next";
import { CoachOsShell } from "@/components/coach/os/CoachOsShell";
import { RosterList } from "@/components/coach/os/RosterList";
import { loadCoachOsContext, loadRoster } from "@/lib/coach/data";

export const metadata: Metadata = { title: "Roster · TRIQ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CoachRosterPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) || {};
  const ctx = await loadCoachOsContext(typeof sp.scope === "string" ? sp.scope : null);
  const { rows, batchCount, currentMonth } = await loadRoster(ctx);
  return (
    <CoachOsShell
      section="roster"
      title="Roster"
      subtitle={`${rows.length} athlete${rows.length === 1 ? "" : "s"} · ${batchCount} batch${batchCount === 1 ? "" : "es"}`}
      scope={ctx.scope}
      canViewAll={ctx.canViewAll}
    >
      <RosterList rows={rows} currentMonth={currentMonth} scopeQuery={ctx.scope === "all" ? "&scope=all" : ""} />
    </CoachOsShell>
  );
}
