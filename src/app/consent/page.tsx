import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { getGuardianStudentIds } from "@/lib/family/guardians";
import { consentSummary } from "@/lib/consent/ledger";
import { consentRowsForStudent } from "@/lib/consent/server";
import { CONSENT_NOTICE_VERSION, CONSENT_PURPOSES, type ConsentPurpose } from "@/lib/consent/purposes";
import { ConsentForm } from "@/components/consent/ConsentForm";
import { Page } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy choices | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ConsentPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.consentLedger) notFound();
  const session = await requireAuth(["PARENT"]);
  const sp = await searchParams;

  const ids = await getGuardianStudentIds(session.id);
  const children = ids.length ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const ordered = ids.map((id) => children.find((c) => c.id === id)).filter((c): c is { id: string; name: string } => !!c);
  const selected = ordered.find((c) => c.id === sp.child) ?? ordered[0] ?? null;

  type Initial = Record<ConsentPurpose, { state: "GRANTED" | "WITHDRAWN" | "NOT_ASKED"; since: string | null }>;
  let initial: Initial | null = null;
  if (selected) {
    const summary = consentSummary(await consentRowsForStudent(selected.id), selected.id);
    const built = {} as Initial;
    for (const p of CONSENT_PURPOSES) built[p] = { state: summary[p].state, since: summary[p].since ? summary[p].since!.toISOString() : null };
    initial = built;
  }

  return (
    <Page
      eyebrow="Family"
      title="Privacy choices"
      actions={
        <Link href="/family" className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-3 text-zinc-200">
          Back
        </Link>
      }
    >
      {ordered.length > 1 ? (
        <nav aria-label="Choose a child" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {ordered.map((c) => (
            <Link
              key={c.id}
              href={`/consent?child=${c.id}`}
              aria-current={c.id === selected?.id ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
                c.id === selected?.id ? "bg-lime-400 font-semibold text-zinc-950" : "border border-white/10 text-zinc-300"
              }`}
            >
              {c.name.split(/\s+/)[0]}
            </Link>
          ))}
        </nav>
      ) : null}

      {!selected || !initial ? (
        <p className="mt-6 text-sm text-zinc-400">No children are linked to your account.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-zinc-400">
            Choose what the academy and TRIQ may do with {selected.name.split(/\s+/)[0]}&apos;s information. You can change these at any time; every
            change is recorded. To confirm it is you, we send a code to your registered phone.
          </p>
          <ConsentForm key={selected.id} studentId={selected.id} childName={selected.name} initial={initial} />
          <p className="pt-2 text-xs text-zinc-600">Notice version {CONSENT_NOTICE_VERSION}</p>
        </div>
      )}
    </Page>
  );
}
