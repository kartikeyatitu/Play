import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { getGuardianStudentIds } from "@/lib/family/guardians";
import { waiverStatusForStudent } from "@/lib/consent/waivers";
import { WaiverSignForm } from "@/components/waivers/WaiverSignForm";
import { Card, Page, Pill, Section, istDate } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Waivers | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FamilyWaiversPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.waivers) notFound();
  const session = await requireAuth(["PARENT"]);
  const sp = await searchParams;
  const only = typeof sp.child === "string" ? sp.child : "";

  const ids = await getGuardianStudentIds(session.id);
  const wanted = only && ids.includes(only) ? [only] : ids;
  const children = wanted.length
    ? await db.student.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true, orgId: true } })
    : [];
  const orgIds = Array.from(new Set(children.map((c) => c.orgId).filter((o): o is string => !!o)));
  const [templates, signatures, me] = await Promise.all([
    orgIds.length ? db.waiverTemplate.findMany({ where: { orgId: { in: orgIds } }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    wanted.length
      ? db.waiverSignature.findMany({ where: { studentId: { in: wanted } }, select: { templateId: true, version: true, studentId: true, signedAt: true } })
      : Promise.resolve([]),
    db.user.findUnique({ where: { id: session.id }, select: { name: true } }),
  ]);
  const bodyById = new Map(templates.map((t) => [t.id, t.body]));

  return (
    <Page
      eyebrow="Family"
      title="Waivers"
      actions={
        <Link href="/family" className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-3 text-zinc-200">
          Back
        </Link>
      }
    >
      {children.length === 0 ? <p className="mt-6 text-sm text-zinc-400">No children are linked to your account.</p> : null}
      {children.map((c) => {
        const rows = waiverStatusForStudent(
          templates.filter((t) => t.orgId === c.orgId),
          signatures,
          c.id,
        );
        return (
          <Section key={c.id} title={c.name}>
            {rows.length === 0 ? <p className="text-sm text-zinc-400">The academy has no waivers to sign.</p> : null}
            <div className="space-y-3">
              {rows.map(({ template, status, signedAt }) => (
                <Card key={template.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{template.title}</p>
                    {status === "SIGNED" ? (
                      <Pill tone="emerald">Signed</Pill>
                    ) : status === "RESIGN_NEEDED" ? (
                      <Pill tone="amber">Updated, sign again</Pill>
                    ) : (
                      <Pill tone="amber">To sign</Pill>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">Version {template.version}</p>
                  {status === "SIGNED" ? (
                    <p className="mt-2 text-sm text-zinc-400">Signed on {signedAt ? istDate(signedAt) : ""}.</p>
                  ) : (
                    <>
                      <details className="mt-3 rounded-lg border border-white/10 bg-zinc-900/60 p-3" open>
                        <summary className="cursor-pointer text-sm text-zinc-300">Read the waiver</summary>
                        <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{bodyById.get(template.id)}</div>
                      </details>
                      <div className="mt-3">
                        <WaiverSignForm templateId={template.id} studentId={c.id} childName={c.name.split(/\s+/)[0] || c.name} defaultName={me?.name} />
                      </div>
                    </>
                  )}
                </Card>
              ))}
            </div>
          </Section>
        );
      })}
    </Page>
  );
}
