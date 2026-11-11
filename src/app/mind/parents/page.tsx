import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/mind", label: "Mind & Performance", sub: "Confidence, nerves and focus" },
          { href: "/pros", label: "Find a professional", sub: "Physios, nutritionists, counsellors" },
          { href: "/mind/support", label: "Need help now?", sub: "Urgent support contacts" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="rounded-xl border border-line bg-surface px-4 py-3 hover:bg-surface-2">
            <span className="block text-sm font-semibold text-ink">{l.label}</span>
            <span className="block text-xs text-ink-subtle">{l.sub}</span>
          </Link>
        ))}
      </div>
    </MindShell>
  );
}
