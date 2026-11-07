import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { getGuardianStudentIds, guardiansOfStudent } from "@/lib/family/guardians";
import { waiverStatusForStudent } from "@/lib/consent/waivers";
import { exportDownloadOpen } from "@/lib/consent/data-requests";
import { studentIdsForRequests } from "@/lib/consent/data-requests-server";
import { ChildDataExport, type ExportRequestView } from "@/components/family/ChildDataExport";
import { Card, Page, Pill, Section } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My family | Triq", robots: { index: false, follow: false } };

const RELATION: Record<string, string> = { MOTHER: "Mother", FATHER: "Father", GUARDIAN: "Guardian", OTHER: "Guardian" };

export default async function FamilyPage() {
  if (!FEATURES.familyAccounts && !FEATURES.waivers && !FEATURES.consentLedger && !FEATURES.dataRequests) notFound();
  const session = await requireAuth(["PARENT"]);

  const ids = await getGuardianStudentIds(session.id);
  const children = ids.length
    ? await db.student.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, orgId: true, org: { select: { name: true } }, enrollments: { select: { batch: { select: { name: true } } } } },
      })
    : [];
  const ordered = ids.map((id) => children.find((c) => c.id === id)).filter((c): c is (typeof children)[number] => !!c);

  const guardians = FEATURES.familyAccounts ? await Promise.all(ordered.map((c) => guardiansOfStudent(c.id))) : [];

  const orgIds = Array.from(new Set(ordered.map((c) => c.orgId).filter((o): o is string => !!o)));
  const [templates, signatures] = FEATURES.waivers && ordered.length
    ? await Promise.all([
        db.waiverTemplate.findMany({ where: { orgId: { in: orgIds } }, select: { id: true, orgId: true, title: true, version: true, active: true } }),
        db.waiverSignature.findMany({ where: { studentId: { in: ids } }, select: { templateId: true, version: true, studentId: true, signedAt: true } }),
      ])
    : [[], []];

  const exportsByStudent = new Map<string, ExportRequestView[]>();
  if (FEATURES.dataRequests) {
    const reqs = await db.dataRequest.findMany({ where: { userId: session.id, type: "EXPORT" }, orderBy: { createdAt: "desc" }, take: 30 });
    const map = await studentIdsForRequests(reqs.map((r) => r.referenceId));
    for (const r of reqs) {
      const sid = map.get(r.referenceId);
      if (!sid) continue;
      const list = exportsByStudent.get(sid) ?? [];
      if (list.length < 3) list.push({ referenceId: r.referenceId, status: r.status, createdAt: r.createdAt.toISOString(), canDownload: exportDownloadOpen(r) });
      exportsByStudent.set(sid, list);
    }
  }

  return (
    <Page
      eyebrow="Family"
      title="My children"
      actions={
        <Link href="/parent" className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-3 text-zinc-200">
          Back
        </Link>
      }
    >
      {ordered.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">No children are linked to your account yet. Ask your academy to add you.</p>
      ) : null}
      {ordered.map((c, i) => {
        const statuses = FEATURES.waivers
          ? waiverStatusForStudent(
              templates.filter((t) => t.orgId === c.orgId),
              signatures,
              c.id,
            )
          : [];
        const pendingWaivers = statuses.filter((s) => s.status !== "SIGNED").length;
        return (
          <Section key={c.id} title={c.name}>
            <Card>
              <p className="text-sm text-zinc-400">
                {c.org?.name ?? "Academy"}
                {c.enrollments.length ? ` · ${c.enrollments.map((e) => e.batch.name).join(", ")}` : ""}
              </p>

              {FEATURES.familyAccounts && guardians[i]?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Guardians</p>
                  <ul className="mt-1 space-y-1 text-sm text-zinc-200">
                    {guardians[i].map((g) => (
                      <li key={g.userId} className="flex items-center gap-2">
                        <span>{g.userId === session.id ? `${g.name} (you)` : g.name}</span>
                        {g.primary ? <Pill tone="lime">Primary</Pill> : g.relation ? <Pill>{RELATION[g.relation] ?? "Guardian"}</Pill> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                {FEATURES.waivers ? (
                  <Link href={`/family/waivers?child=${c.id}`} className="flex min-h-12 items-center justify-between rounded-lg border border-white/10 px-3 text-sm text-zinc-100">
                    <span>Waivers</span>
                    {pendingWaivers ? <Pill tone="amber">{pendingWaivers} to sign</Pill> : <Pill tone="emerald">All signed</Pill>}
                  </Link>
                ) : null}
                {FEATURES.consentLedger ? (
                  <Link href={`/consent?child=${c.id}`} className="flex min-h-12 items-center justify-between rounded-lg border border-white/10 px-3 text-sm text-zinc-100">
                    <span>Privacy choices</span>
                    <span aria-hidden className="text-zinc-500">›</span>
                  </Link>
                ) : null}
              </div>

              {FEATURES.dataRequests ? (
                <div className="mt-4">
                  <ChildDataExport studentId={c.id} childName={c.name.split(/\s+/)[0] || c.name} requests={exportsByStudent.get(c.id) ?? []} />
                </div>
              ) : null}
            </Card>
          </Section>
        );
      })}
    </Page>
  );
}
