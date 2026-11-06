import type { Metadata } from "next";
import { EducationList } from "@/components/mind/education-list";
import { requireMindC1 } from "@/components/mind/gate";
import { MindShell } from "@/components/mind/shell";
import { COACH_TOPICS } from "@/lib/mind/education";

export const metadata: Metadata = { title: "For coaches | Mind & Performance | Triq" };

export default function MindCoachesPage() {
  requireMindC1();
  return (
    <MindShell
      title="For coaches"
      intro="Coaches shape how athletes feel about their sport. These pointers cover positive coaching and when to help an athlete find professional support. Always follow your academy's safeguarding policy."
    >
      <EducationList topics={COACH_TOPICS} />
    </MindShell>
  );
}
