import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { checkPermission, hasPermission } from "@/lib/membership";
import { unsignedByBatch } from "@/lib/consent/waivers";
import { publishWaiverTemplate, retireWaiverTemplate } from "@/app/actions/waivers";
import { InviteGuardianForm } from "@/components/family/InviteGuardianForm";
import { Card, Field, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls, istDate } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Families & waivers | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function OrgWaiversPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.waivers && !FEATURES.familyAccounts) notFound();
  const sp = await searchParams;
  const auth = await checkPermission(null);
  if (!auth.ok) {
    return (
      <Page eyebrow="Families" title="Families & waivers">
        <Flash error={auth.error} />
      </Page>
    );
  }
  const { session, membership } = auth;
  const orgId = session.orgId;
  const isOwner = hasPermission(membership, "settings.manage");
  const canManageStudents = hasPermission(membership, "students.manage");

  const templates = FEATURES.waivers
    ? await db.waiverTemplate.findMany({ where: { orgId }, orderBy: [{ title: "asc" }, { version: "desc" }] })
    : [];
  const active = templates.filter((t) => t.active);
  const selected = active.find((t) => t.id === one(sp.template)) ?? active[0] ?? null;

  const batches = await db.batch.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, enrollments: { select: { student: { select: { id: true, name: true } } } } },
  });
  const signatures = selected
    ? await db.waiverSignature.findMany({ where: { orgId, templateId: selected.id, version: selected.version }, select: { templateId: true, version: true, studentId: true, signedAt: true } })
    : [];
  const report = selected
    ? unsignedByBatch(
        batches.map((b) => ({ id: b.id, name: b.name, students: b.enrollments.map((e) => e.student).sort((x, y) => x.name.localeCompare(y.name)) })),
        selected,
        signatures,
      )
    : [];

  const studentOptions = FEATURES.familyAccounts && canManageStudents
    ? (await db.student.findMany({
        where: { orgId },
        orderBy: { name: "asc" },
        take: 1000,
        select: { id: true, name: true, enrollments: { take: 1, select: { batch: { select: { name: true } } } } },
      })).map((s) => ({ id: s.id, name: s.name, batch: s.enrollments[0]?.batch.name ?? null }))
    : [];

  return (
    <Page
      eyebrow="Families"
      title="Families & waivers"
      actions={
        <Link href="/org" className={ghostButtonCls}>
          Back
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />

      {FEATURES.waivers ? (
        <>
          <Section title="Unsigned by batch">
            {!selected ? (
              <p className="text-sm text-zinc-400">Publish a waiver below to start collecting signatures.</p>
            ) : (
              <>
                {active.length > 1 ? (
                  <nav className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {active.map((t) => (
                      <Link
                        key={t.id}
                        href={`/org/waivers?template=${t.id}`}
                        className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${t.id === selected.id ? "bg-lime-400 font-semibold text-zinc-950" : "border border-white/10 text-zinc-300"}`}
                      >
                        {t.title}
                      </Link>
                    ))}
                  </nav>
                ) : null}
                <p className="mb-3 text-sm text-zinc-400">
                  {selected.title} · version {selected.version}. Parents sign from their TRIQ app under Family → Waivers.
                </p>
                <div className="space-y-2">
                  {report.map((b) => (
                    <details key={b.batchId} className="rounded-xl border border-white/10 bg-white/[0.03]">
                      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 text-sm">
                        <span className="text-white">{b.batchName}</span>
                        {b.unsigned.length ? <Pill tone="amber">{b.unsigned.length} of {b.total} unsigned</Pill> : <Pill tone="emerald">All {b.total} signed</Pill>}
                      </summary>
                      {b.unsigned.length ? (
                        <ul className="space-y-1 px-4 pb-3 text-sm text-zinc-300">
                          {b.unsigned.map((s) => (
                            <li key={s.id}>{s.name}</li>
                          ))}
                        </ul>
                      ) : null}
                    </details>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section title="Waiver texts">
            <div className="space-y-2">
              {templates.length === 0 ? <p className="text-sm text-zinc-400">No waivers yet.</p> : null}
              {templates.map((t) => (
                <Card key={t.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{t.title}</p>
                      <p className="text-xs text-zinc-500">
                        Version {t.version} · {istDate(t.createdAt)}
                      </p>
                    </div>
                    {t.active ? <Pill tone="lime">Current</Pill> : <Pill>Retired</Pill>}
                  </div>
                  {t.active && isOwner ? (
                    <form action={retireWaiverTemplate} className="mt-3">
                      <input type="hidden" name="templateId" value={t.id} />
                      <button className={`${ghostButtonCls} min-h-11`}>Stop asking for this waiver</button>
                    </form>
                  ) : null}
                </Card>
              ))}
            </div>

            {isOwner ? (
              <form action={publishWaiverTemplate} className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Publish a waiver or a new version</p>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Use the same title to replace the current version. Every child then needs a fresh signature. Have a lawyer review the text.
                </p>
                <Field label="Title">
                  <input name="title" required maxLength={120} list="waiver-titles" className={`${inputCls} min-h-12`} />
                  <datalist id="waiver-titles">
                    {Array.from(new Set(templates.map((t) => t.title))).map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Waiver text">
                  <textarea name="body" required rows={8} className={inputCls} />
                </Field>
                <button className={`${buttonCls} min-h-12 w-full`}>Publish</button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">Only the academy owner can publish waiver text.</p>
            )}
          </Section>
        </>
      ) : null}

      {FEATURES.familyAccounts && canManageStudents ? (
        <Section title="Add a second guardian">
          <Card>
            <p className="mb-3 text-xs leading-relaxed text-zinc-400">
              A child can have two guardians. The second guardian gets their own login and can sign waivers and set privacy choices. The first parent stays the main contact for fees.
            </p>
            <InviteGuardianForm students={studentOptions} />
          </Card>
        </Section>
      ) : null}
    </Page>
  );
}
