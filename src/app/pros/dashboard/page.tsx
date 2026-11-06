import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { APPOINTMENT_STATUS_LABELS, isAppointmentStatus } from "@/lib/wellness";
import { prosEnabled } from "@/lib/pros/flag";
import { splitBio } from "@/lib/pros/meta";
import { parseBookingNote } from "@/lib/pros/booking";
import { proVerificationState } from "@/lib/pros/verification";
import { HEALTH_CATEGORY_BY_TYPE, PRO_TYPE_LABELS } from "@/lib/pros/types";
import { BookingActions } from "@/components/pros/BookingActions";
import { Block, FlashMsg, Notice, Panel, Shell, Tag, VerificationBadge, ghostBtn, istDateTime } from "@/components/pros/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TRIQ Connect dashboard | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

const statusLabel = (s: string) => (isAppointmentStatus(s) ? APPOINTMENT_STATUS_LABELS[s] : s);

export default async function ProsDashboardPage({ searchParams }: { searchParams: SP }) {
  if (!prosEnabled()) notFound();
  const session = await requireAuth();
  const sp = await searchParams;
  const now = new Date();

  const [profile, provider, credentials, incoming, outgoing] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: session.id }, select: { id: true, bio: true, isPublic: true } }),
    db.wellnessProvider.findUnique({ where: { userId: session.id } }),
    db.professionalCredential.findMany({
      where: { userId: session.id },
      select: { title: true, status: true, verifiedById: true, verifiedAt: true },
    }),
    db.wellnessAppointment.findMany({ where: { providerUserId: session.id }, orderBy: { scheduledAt: "asc" }, take: 100 }),
    db.wellnessAppointment.findMany({ where: { requesterId: session.id }, orderBy: { scheduledAt: "desc" }, take: 50 }),
  ]);
  const meta = splitBio(profile?.bio).meta;
  const providerForType = meta && provider && provider.category === HEALTH_CATEGORY_BY_TYPE[meta.type] ? provider : null;
  const verification = meta ? proVerificationState({ type: meta.type, provider: providerForType, credentials }) : null;

  const partyIds = Array.from(new Set([...incoming.map((a) => a.requesterId), ...outgoing.map((a) => a.providerUserId)]));
  const people = partyIds.length
    ? await db.user.findMany({ where: { id: { in: partyIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const openIncoming = incoming.filter((a) => a.status === "REQUESTED" || a.status === "CONFIRMED");
  const pastIncoming = incoming.filter((a) => !(a.status === "REQUESTED" || a.status === "CONFIRMED")).slice(-20);

  return (
    <Shell
      eyebrow="TRIQ Connect"
      title="Dashboard"
      actions={
        <>
          <Link href="/pros" className={ghostBtn}>
            Directory
          </Link>
          <Link href="/pros/join" className={ghostBtn}>
            {meta ? "Edit profile" : "Join as a professional"}
          </Link>
        </>
      }
    >
      <FlashMsg error={sp.error} saved={sp.saved} />

      {meta && verification && (
        <Panel className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink">{PRO_TYPE_LABELS[meta.type]}</span>
          <VerificationBadge state={verification} />
          <Tag>{profile?.isPublic && (!providerForType || providerForType.isListed) ? "Listed" : "Not listed"}</Tag>
        </Panel>
      )}

      {meta && (
        <Block title="Requests to you" hint="Only you and the person who asked can see a request.">
          {openIncoming.length === 0 ? (
            <Notice>No open requests.</Notice>
          ) : (
            <div className="space-y-2">
              {openIncoming.map((a) => {
                const { forLabel, reason } = parseBookingNote(a.note);
                return (
                  <Panel key={a.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm">
                        <p className="font-medium text-ink">{istDateTime(a.scheduledAt)}</p>
                        <p className="text-ink-muted">
                          From {nameOf.get(a.requesterId) ?? "a Triq user"}
                          {forLabel ? ` for ${forLabel}` : ""}
                        </p>
                        {reason ? <p className="mt-1 whitespace-pre-line text-ink-muted">&ldquo;{reason}&rdquo;</p> : null}
                      </div>
                      <Tag>{statusLabel(a.status)}</Tag>
                    </div>
                    <BookingActions id={a.id} status={a.status} actor="PROVIDER" scheduledAt={a.scheduledAt} now={now} />
                  </Panel>
                );
              })}
            </div>
          )}
          {pastIncoming.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-ink-muted">Past requests ({pastIncoming.length})</summary>
              <ul className="mt-2 space-y-1">
                {pastIncoming.map((a) => (
                  <li key={a.id} className="text-ink-subtle">
                    {istDateTime(a.scheduledAt)} · {nameOf.get(a.requesterId) ?? "a Triq user"} · {statusLabel(a.status)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Block>
      )}

      <Block title="Your requests">
        {outgoing.length === 0 ? (
          <Notice>
            You have not requested a session.{" "}
            <Link href="/pros" className="underline">
              Find a professional
            </Link>
          </Notice>
        ) : (
          <div className="space-y-2">
            {outgoing.map((a) => {
              const { forLabel } = parseBookingNote(a.note);
              return (
                <Panel key={a.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium text-ink">{istDateTime(a.scheduledAt)}</p>
                      <p className="text-ink-muted">
                        With {nameOf.get(a.providerUserId) ?? "a professional"}
                        {forLabel ? ` · for ${forLabel}` : ""}
                      </p>
                      {a.status === "CANCELLED" && a.cancelReason ? <p className="text-ink-subtle">Reason: {a.cancelReason}</p> : null}
                    </div>
                    <Tag>{statusLabel(a.status)}</Tag>
                  </div>
                  <BookingActions id={a.id} status={a.status} actor="REQUESTER" scheduledAt={a.scheduledAt} now={now} />
                </Panel>
              );
            })}
          </div>
        )}
      </Block>
    </Shell>
  );
}
