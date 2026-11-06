import type { Metadata } from "next";
import { EducationList } from "@/components/mind/education-list";
import { requireMindC1 } from "@/components/mind/gate";
import { MindShell } from "@/components/mind/shell";
import { PARENT_TOPICS } from "@/lib/mind/education";

export const metadata: Metadata = { title: "For parents | Mind & Performance | Triq" };

export default function MindParentsPage() {
  requireMindC1();
  return (
    <MindShell
      title="For parents and guardians"
      intro="How the adults around a young athlete behave has a big effect on whether sport stays enjoyable and healthy. These are general pointers, not rules, and not clinical advice."
    >
      <EducationList topics={PARENT_TOPICS} />
    </MindShell>
  );
}
