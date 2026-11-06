// Static support page. CONTACTS TO BE CONFIRMED BY THE CLINICAL ADVISOR BEFORE LAUNCH
// (see src/lib/mind/support.ts). No form, no data collection, no analytics events.
import type { Metadata } from "next";
import { requireMindC1 } from "@/components/mind/gate";
import { MindShell, SectionTitle } from "@/components/mind/shell";
import { CONTACTS_PENDING_NOTE, SUPPORT_REGIONS, TRUSTED_ADULT_STEPS } from "@/lib/mind/support";

export const metadata: Metadata = { title: "Get support | Mind & Performance | Triq" };

export default function MindSupportPage() {
  requireMindC1();
  return (
    <MindShell title="Need to talk to someone now?" intro="You do not have to handle hard feelings on your own. Here is how to reach help.">
      <section aria-labelledby="danger-h" className="rounded-xl border-2 border-danger/50 bg-surface p-4">
        <h2 id="danger-h" className="text-lg font-semibold text-ink">
          If you or someone else is in danger right now
        </h2>
        <p className="mt-1 text-sm text-ink">Call your local emergency number straight away, or go to the nearest hospital.</p>
      </section>

      <div className="mt-6 space-y-6">
        {SUPPORT_REGIONS.map((r) => (
          <section key={r.id} aria-labelledby={`${r.id}-h`}>
            <SectionTitle id={`${r.id}-h`}>{r.region}</SectionTitle>
            <ul className="mt-3 space-y-3">
              {r.contacts.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-sm text-ink-muted">{c.detail}</p>
                  </div>
                  <a
                    href={`tel:${c.dial}`}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-volt px-4 text-base font-semibold tabular-nums text-volt-fg"
                    aria-label={`Call ${c.name} on ${c.number}`}
                  >
                    {c.number}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section aria-labelledby="adult-h" className="mt-8">
        <SectionTitle id="adult-h">Talk to a trusted adult</SectionTitle>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink">
          {TRUSTED_ADULT_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm text-ink-muted">
        TRIQ does not provide counselling or crisis support, and nobody at TRIQ monitors these pages. If you are not in danger but are finding things hard, a family doctor or a
        qualified mental health professional can help.
      </p>
      <p className="mt-4 text-xs text-ink-subtle">{CONTACTS_PENDING_NOTE}</p>
    </MindShell>
  );
}
