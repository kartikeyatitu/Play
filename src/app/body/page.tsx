import type { Metadata } from "next";
import Link from "next/link";
import { FEATURES } from "@/lib/features";
import { FITNESS_TESTS, UNIT_LABELS } from "@/lib/body/tests";
import { getBodyViewer } from "@/lib/body/access";
import { BodyNav, BodyShell, Chip, NotEnabled, Panel, SectionTitle } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TRIQ Body | Triq", robots: { index: false, follow: false } };

export default async function BodyHome() {
  // Signed-in area. The catalogue itself is a constant and needs no database tables.
  const viewer = await getBodyViewer();
  return (
    <BodyShell title="Fitness test catalogue">
      <BodyNav current="home" />
      <p className="mt-4 text-sm text-ink-muted">
        Standard tests with one protocol each. Results are only compared with the same test, the same protocol and the same age
        band, and never across sports. These are performance measures, not medical checks.
      </p>
      {!FEATURES.fitnessTests ? <NotEnabled what="Recording test results is not switched on for your academy yet." /> : null}
      {FEATURES.fitnessTests ? (
        <p className="mt-4 text-sm">
          <Link href="/body/athletes" className="text-volt-ink underline underline-offset-4">
            {viewer.appRole === "PARENT" ? "See your child's results" : "Record or view an athlete's results"} →
          </Link>
        </p>
      ) : null}

      <SectionTitle>Tests</SectionTitle>
      <ul className="mt-3 space-y-3">
        {FITNESS_TESTS.map((t) => (
          <li key={t.key} id={t.key}>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="text-sm text-ink-muted">{t.measures}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Chip>{UNIT_LABELS[t.unit]}</Chip>
                  <Chip tone="accent">{t.better === "lower" ? "↓ lower is better" : "↑ higher is better"}</Chip>
                  <Chip>{t.minAge}+ yrs</Chip>
                </div>
              </div>
              <p className="mt-2 text-sm">{t.ageNotes}</p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-ink-muted">How to run it (protocol {t.protocol})</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {t.protocolSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <p className="mt-2 text-ink-muted">Equipment: {t.equipment.join(", ")}</p>
              </details>
            </Panel>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-ink-subtle">
        Warm up before every test. Stop if an athlete feels pain, dizziness or is unwell. If you have any health concern about an
        athlete, check with their family and a qualified professional before testing.
      </p>
    </BodyShell>
  );
}
