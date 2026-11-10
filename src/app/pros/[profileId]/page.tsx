import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { myChildrenWhere } from "@/lib/family/guardians";
import { getSession } from "@/lib/auth";
import { prosEnabled } from "@/lib/pros/flag";
import { loadListing } from "@/lib/pros/data";
import { DELIVERY_MODE_LABELS, PRO_TYPE_LABELS } from "@/lib/pros/types";
import { MAX_REASON } from "@/lib/pros/booking";
import { requestProsBooking } from "@/app/actions/pros";
import { Block, Field, FlashMsg, Notice, Panel, Shell, Tag, VerificationBadge, fieldCls, ghostBtn, primaryBtn } from "@/components/pros/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sports professional | Triq", robots: { index: false, follow: false } };

type Params = Promise<{ profileId: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProProfilePage({ params, searchParams }: { params: Params; searchParams: SP }) {
  if (!prosEnabled()) notFound();
  const { profileId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(profileId)) notFound();
  const sp = await searchParams;
  const pro = await loadListing(profileId);
  if (!pro) notFound();

  const session = await getSession();
  const isSelf = session?.id === pro.userId;
  const children =
    session?.role === "PARENT"
      ? await db.student.findMany({ where: await myChildrenWhere(session.id), select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [];
  const experience = await db.professionalExperience.findMany({
    where: { userId: pro.userId },
    orderBy: { startYear: "desc" },
    take: 10,
    select: { id: true, title: true, organization: true, startYear: true, endYear: true },
  });

  return (
    <Shell
      eyebrow={`TRIQ Connect · ${PRO_TYPE_LABELS[pro.type]}`}
      title={pro.name}
      actions={
        <Link href="/pros" className={ghostBtn}>
          All professionals
        </Link>
      }
    >
      <FlashMsg error={sp.error} saved={sp.saved} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <VerificationBadge state={pro.verification} />
        {pro.modes.map((m) => (
          <Tag key={m}>{DELIVERY_MODE_LABELS[m]}</Tag>
        ))}
        {pro.city ? <Tag>{pro.city}</Tag> : null}
      </div>
      {pro.headline ? <p className="mt-4 text-ink">{pro.headline}</p> : null}
      {pro.bio ? <p className="mt-3 whitespace-pre-line text-sm text-ink-muted">{pro.bio}</p> : null}

      <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-subtle">Specialisations</dt>
          <dd className="text-ink">{pro.specialisations.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">Sports</dt>
          <dd className="text-ink">{pro.sports.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">Languages</dt>
          <dd className="text-ink">{pro.languages.join(", ") || "—"}</dd>
        </div>
      </dl>

      {experience.length > 0 && (
        <Block title="Experience">
          <ul className="space-y-1 text-sm">
            {experience.map((e) => (
              <li key={e.id} className="text-ink">
                {e.title} · {e.organization}{" "}
                <span className="text-ink-subtle">
                  ({e.startYear}–{e.endYear ?? "now"})
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Request a session" id="request">
        {isSelf ? (
          <Notice>This is your listing. Requests appear in your dashboard.</Notice>
        ) : !pro.acceptsRequests ? (
          <Notice>
            {pro.providerId
              ? "This professional is not taking requests through Triq right now."
              : "Session requests are available for verified psychologists, counsellors, physiotherapists and nutritionists."}
          </Notice>
        ) : !session ? (
          <Notice>
            <Link href="/login" className="underline">
              Sign in
            </Link>{" "}
            to request a session.
          </Notice>
        ) : session.role === "PARENT" && children.length === 0 ? (
          <Notice>Parents can request sessions for their own children. We could not find a child on your account.</Notice>
        ) : (
          <Panel>
            <form action={requestProsBooking} className="space-y-4">
              <input type="hidden" name="profileId" value={pro.profileId} />
              {session.role === "PARENT" ? (
                <Field label="Who is this for?">
                  <select name="for" required className={fieldCls} defaultValue="">
                    <option value="" disabled>
                      Choose your child
                    </option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <input type="hidden" name="for" value="SELF" />
              )}
              <Field label="Preferred date and time (IST)" hint="The professional will confirm or decline this time.">
                <input type="datetime-local" name="scheduledAt" required className={fieldCls} />
              </Field>
              <Field label="Short reason (optional)">
                <textarea name="reason" maxLength={MAX_REASON} rows={2} className={fieldCls} placeholder="e.g. Pre-tournament nerves, wants to work on focus" />
              </Field>
              <Notice tone="warn">
                Please do not include medical details, diagnoses, medication or test results here. Share those directly with the
                professional once you are in their care. Only you and the professional can see this request.
              </Notice>
              <p className="text-xs text-ink-subtle">
                Triq only passes on your request. It is not an emergency service; if someone is in danger, call 112.
              </p>
              <button className={primaryBtn}>Send request</button>
            </form>
          </Panel>
        )}
      </Block>
    </Shell>
  );
}
