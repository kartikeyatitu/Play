import type { Metadata } from "next";
import { getBodyViewer } from "@/lib/body/access";
import { LOAD_EXPLAINER } from "@/lib/body/load";
import { LoadCalculator } from "@/components/body/LoadCalculator";
import { BodyNav, BodyShell, Panel } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Training load | TRIQ Body", robots: { index: false, follow: false } };

export default async function LoadPage() {
  await getBodyViewer(); // signed-in area; this page reads no tables
  return (
    <BodyShell title="Training load">
      <BodyNav current="load" />
      <Panel className="mt-4">
        <h2 className="text-sm font-semibold">What this is (and isn't)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {LOAD_EXPLAINER.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Panel>
      <LoadCalculator today={new Date().toISOString().slice(0, 10)} />
      <p className="mt-6 text-xs text-ink-subtle">Nothing on this screen is saved.</p>
    </BodyShell>
  );
}
