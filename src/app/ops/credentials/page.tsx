import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { CREDENTIAL_STATUSES, canSetCredentialStatus, credentialLabel } from "@/lib/credentials";
import { reviewProfessionalCredential, reviewProviderCredential } from "./actions";
import { PROVIDER_CATEGORY_LABELS, isProviderCategory } from "@/lib/wellness";
import { Card, Flash, Page, Pill, Section, buttonCls, inputCls, istDate } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ops · Credentials | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

function MoveForm({ action, id, from }: { action: (fd: FormData) => Promise<void>; id: string; from: string }) {
  const moves = CREDENTIAL_STATUSES.filter((to) => canSetCredentialStatus(from, to, "VERIFIER"));
  if (!moves.length) return null;
  return (
    <form action={action} className="mt-3 flex flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" className={`${inputCls} w-auto`}>
        {moves.map((m) => (
          <option key={m} value={m}>
            {credentialLabel(m)}
          </option>
        ))}
      </select>
      <input name="reason" maxLength={300} placeholder="Reason (required when rejecting)" className={`${inputCls} flex-1`} />
      <button className={buttonCls}>Save</button>
    </form>
  );
}

export default async function OpsCredentialsPage({ searchParams }: { searchParams: SP }) {
  await requireAuth(["SUPER_ADMIN"]);
  const sp = await searchParams;

  const professional = FEATURES.careers
    ? await db.professionalCredential.findMany({
        where: { status: { in: ["SUBMITTED", "REVIEWED", "VERIFIED"] } },
        orderBy: { createdAt: "asc" },
        take: 100,
      })
    : [];
  const users = professional.length
    ? await db.user.findMany({ where: { id: { in: professional.map((c) => c.userId) } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const providers = FEATURES.wellness
    ? await db.wellnessProvider.findMany({
        where: { credentialStatus: { in: ["SUBMITTED", "REVIEWED", "VERIFIED"] } },
        orderBy: { updatedAt: "asc" },
        take: 100,
        select: { id: true, displayName: true, category: true, registrationBody: true, registrationNumber: true, credentialStatus: true, updatedAt: true },
      })
    : [];

  return (
    <Page eyebrow="Triq ops" title="Credential verification">
      <Flash error={sp.error} saved={sp.saved} />
      <p className="mt-3 text-sm text-zinc-400">
        Only mark a credential verified after checking the evidence with the issuer. Every change is audited.
      </p>

      <Section title="Professional credentials (Careers)">
        {!FEATURES.careers && <p className="text-sm text-zinc-500">Careers is switched off.</p>}
        {FEATURES.careers && professional.length === 0 && <p className="text-sm text-zinc-400">Nothing waiting.</p>}
        <div className="space-y-2">
          {professional.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">
                    {c.title}
                    {c.issuer ? ` · ${c.issuer}` : ""}
                    {c.issuedYear ? ` (${c.issuedYear})` : ""}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {nameById.get(c.userId) ?? "User"} · submitted {istDate(c.createdAt)}
                  </p>
                  {c.evidenceUrl && (
                    <a href={c.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-lime-300 hover:underline">
                      Open evidence
                    </a>
                  )}
                </div>
                <Pill tone={c.status === "VERIFIED" ? "emerald" : c.status === "REVIEWED" ? "sky" : "amber"}>{credentialLabel(c.status)}</Pill>
              </div>
              <MoveForm action={reviewProfessionalCredential} id={c.id} from={c.status} />
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Wellness providers">
        {!FEATURES.wellness && <p className="text-sm text-zinc-500">Wellness is switched off.</p>}
        {FEATURES.wellness && providers.length === 0 && <p className="text-sm text-zinc-400">Nothing waiting.</p>}
        <div className="space-y-2">
          {providers.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{p.displayName}</p>
                  <p className="text-xs text-zinc-400">
                    {isProviderCategory(p.category) ? PROVIDER_CATEGORY_LABELS[p.category] : p.category} · {p.registrationBody || "no body given"} ·{" "}
                    {p.registrationNumber || "no number given"} · updated {istDate(p.updatedAt)}
                  </p>
                </div>
                <Pill tone={p.credentialStatus === "VERIFIED" ? "emerald" : p.credentialStatus === "REVIEWED" ? "sky" : "amber"}>
                  {credentialLabel(p.credentialStatus)}
                </Pill>
              </div>
              <MoveForm action={reviewProviderCredential} id={p.id} from={p.credentialStatus} />
            </Card>
          ))}
        </div>
      </Section>
    </Page>
  );
}
