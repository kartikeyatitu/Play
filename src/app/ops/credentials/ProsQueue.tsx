// TRIQ Connect section of the ops credential queue (SUPER_ADMIN page; rendered only when NEXT_PUBLIC_PROS=1).
import { db } from "@/lib/db";
import { credentialLabel } from "@/lib/credentials";
import { splitBio } from "@/lib/pros/meta";
import { proVerificationState } from "@/lib/pros/verification";
import { HEALTH_CATEGORY_BY_TYPE, PRO_TYPE_LABELS, credentialTypeOfTitle, credentialTypesFor } from "@/lib/pros/types";
import { OpsDecisionForm } from "@/components/pros/OpsDecisionForm";
import { VerificationBadge } from "@/components/pros/ui";
import { Card, Pill, Section, istDate } from "@/components/verticals/ui";
import { decideProsCredential, decideProsProvider } from "./actions";

const tone = (s: string) => (s === "VERIFIED" ? "emerald" : s === "REVIEWED" ? "sky" : s === "REJECTED" ? "rose" : "amber");

export async function ProsQueue({ showDone }: { showDone: boolean }) {
  const profiles = await db.professionalProfile.findMany({
    where: { bio: { contains: "[TRIQ Connect] " } },
    select: { id: true, userId: true, bio: true, isPublic: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });
  const pros = profiles.flatMap((p) => {
    const meta = splitBio(p.bio).meta;
    return meta ? [{ ...p, meta }] : [];
  });
  const userIds = pros.map((p) => p.userId);
  const [creds, providers, users] = userIds.length
    ? await Promise.all([
        db.professionalCredential.findMany({ where: { userId: { in: userIds } }, orderBy: { createdAt: "asc" } }),
        db.wellnessProvider.findMany({ where: { userId: { in: userIds } } }),
        db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      ])
    : [[], [], []];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const rows = pros.map((p) => {
    const category = HEALTH_CATEGORY_BY_TYPE[p.meta.type];
    const w = category ? providers.find((x) => x.userId === p.userId && x.category === category) ?? null : null;
    const mine = creds.filter((c) => c.userId === p.userId);
    const pending = (s: string) => s === "SUBMITTED" || s === "REVIEWED";
    const hasPending = (w ? pending(w.credentialStatus) : false) || mine.some((c) => pending(c.status));
    return { p, w, mine, hasPending, state: proVerificationState({ type: p.meta.type, provider: w, credentials: mine }) };
  });
  const visible = rows.filter((r) => showDone || r.hasPending);

  return (
    <Section title="TRIQ Connect professionals" id="pros">
      <p className="mb-3 text-sm text-zinc-400">
        Check each document and registration with the issuing body before verifying. A professional shows as Verified only after you
        record a verification here. {showDone ? <a href="?#pros" className="text-lime-300 hover:underline">Show pending only</a> : <a href="?pros=all#pros" className="text-lime-300 hover:underline">Show everyone</a>}
      </p>
      {visible.length === 0 && <p className="text-sm text-zinc-400">Nothing waiting.</p>}
      <div className="space-y-3">
        {visible.map(({ p, w, mine, state }) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-white">{nameById.get(p.userId) ?? "User"}</p>
                <p className="text-xs text-zinc-400">
                  {PRO_TYPE_LABELS[p.meta.type]} · {p.isPublic ? "listing requested" : "not listed"} · updated {istDate(p.updatedAt)}
                </p>
              </div>
              <VerificationBadge state={state} />
            </div>

            <ul className="mt-3 space-y-0.5 text-xs text-zinc-400">
              {credentialTypesFor(p.meta.type).map((ct) => {
                const got = mine.filter((c) => credentialTypeOfTitle(p.meta.type, c.title)?.id === ct.id);
                return (
                  <li key={ct.id}>
                    {ct.required ? "Required" : "Optional"}: {ct.label} —{" "}
                    {got.length ? got.map((c) => credentialLabel(c.status)).join(", ") : "not submitted"}
                  </li>
                );
              })}
            </ul>

            {w && (
              <div className="mt-3 rounded-lg border border-white/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-zinc-200">
                    Registration: {w.registrationBody || "no body given"} · {w.registrationNumber || "no number given"}
                  </p>
                  <Pill tone={tone(w.credentialStatus)}>{credentialLabel(w.credentialStatus)}</Pill>
                </div>
                {w.credentialStatus === "REJECTED" && w.credentialRejectReason && (
                  <p className="mt-1 text-xs text-zinc-400">Rejected: {w.credentialRejectReason}</p>
                )}
                <OpsDecisionForm action={decideProsProvider} id={w.id} from={w.credentialStatus} />
              </div>
            )}

            {mine.map((c) => (
              <div key={c.id} className="mt-3 rounded-lg border border-white/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-zinc-200">
                      {c.title}
                      {c.issuer ? ` · ${c.issuer}` : ""}
                      {c.issuedYear ? ` (${c.issuedYear})` : ""}
                    </p>
                    {c.evidenceUrl && (
                      <a href={c.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-lime-300 hover:underline">
                        Open evidence
                      </a>
                    )}
                    {c.status === "REJECTED" && c.rejectReason && <p className="text-xs text-zinc-400">Rejected: {c.rejectReason}</p>}
                  </div>
                  <Pill tone={tone(c.status)}>{credentialLabel(c.status)}</Pill>
                </div>
                <OpsDecisionForm action={decideProsCredential} id={c.id} from={c.status} />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </Section>
  );
}
