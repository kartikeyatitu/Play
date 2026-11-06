import type { Metadata } from "next";
import { CoachOsShell } from "@/components/coach/os/CoachOsShell";
import { AvailabilityEditor } from "@/components/coach/os/AvailabilityEditor";
import { loadCoachOsContext } from "@/lib/coach/data";

export const metadata: Metadata = { title: "Availability · TRIQ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Nothing is read or stored yet: there is no field for availability (see src/lib/coach/availability.ts).
export default async function CoachAvailabilityPage() {
  await loadCoachOsContext(null);
  return (
    <CoachOsShell section="availability" title="Availability" subtitle="When you can coach each week">
      <AvailabilityEditor />
    </CoachOsShell>
  );
}
