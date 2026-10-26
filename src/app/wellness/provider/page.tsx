import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { credentialLabel } from "@/lib/credentials";
import {
  APPOINTMENT_STATUS_LABELS,
  PROVIDER_CATEGORIES,
  PROVIDER_CATEGORY_LABELS,
  availableActions,
  isAppointmentStatus,
} from "@/lib/wellness";
import { actOnAppointment, saveProviderProfile } from "@/app/actions/wellness";
import { Card, Field, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls, ist } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My provider profile | Triq Wellness", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

const ACTION_LABELS: Record<string, string> = { CONFIRM: "Confirm", DECLINE: "Decline", COMPLETE: "Mark completed", CANCEL: "Cancel" };

export default async function ProviderDashboard({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.wellness) notFound();
  const session = await requireAuth();
  const sp = await searchParams;
  const provider = await db.wellnessProvider.findUnique({ where: { userId: session.id } });
  const appts = provider
    ? await db.wellnessAppointment.findMany({ where: { providerUserId: session.id }, orderBy: { scheduledAt: "asc" }, take: 100 })
    : [];
  const requesters = appts.length
    ? await db.user.findMany({ where: { id: { in: Array.from(new Set(appts.map((a) => a.requesterId))) } }, select: { id: true, name: true, phone: true, email: true } })
    : [];
  const userById = new Map(requesters.map((u) => [u.id, u]));
  const now = new Date();

  return (
    <Page
      eyebrow="Triq Wellness"
      title="My provider profile"
      actions={
        <Link href="/wellness" className={ghostButtonCls}>
          Wellness home
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />

      <Section title="Profile">
        {provider && (
          <p className="mb-3 text-sm text-zinc-400">
            Credential status: <Pill tone={provider.credentialStatus === "VERIFIED" ? "emerald" : "amber"}>{credentialLabel(provider.credentialStatus)}</Pill>
            {provider.credentialStatus === "REJECTED" && provider.credentialRejectReason ? ` — ${provider.credentialRejectReason}` : ""}
          </p>
        )}
        <form action={saveProviderProfile} className="grid gap-3 sm:grid-cols-2">
          <Field label="Name shown to clients">
            <input name="displayName" required maxLength={80} defaultValue={provider?.displayName ?? session.name ?? ""} className={inputCls} />
          </Field>
          <Field label="Service category">
            <select name="category" defaultValue={provider?.category ?? "PHYSIOTHERAPY"} className={inputCls}>
              {PROVIDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PROVIDER_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input name="city" maxLength={80} defaultValue={provider?.city ?? ""} className={inputCls} />
          </Field>
          <Field label="Services offered">
            <input name="services" maxLength={500} defaultValue={provider?.services ?? ""} placeholder="e.g. sports injury rehab, taping" className={inputCls} />
          </Field>
          <Field label="Registration body (e.g. IAP, state council)">
            <input name="registrationBody" maxLength={120} defaultValue={provider?.registrationBody ?? ""} className={inputCls} />
          </Field>
          <Field label="Registration number (only Triq's verification team sees this)">
            <input name="registrationNumber" maxLength={60} defaultValue={provider?.registrationNumber ?? ""} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="About you">
              <textarea name="bio" rows={4} maxLength={2000} defaultValue={provider?.bio ?? ""} className={inputCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="isListed" defaultChecked={provider?.isListed ?? false} /> List me in Triq Wellness discovery
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="acceptingRequests" defaultChecked={provider?.acceptingRequests ?? true} /> Accepting new requests
          </label>
          <div>
            <button className={buttonCls}>Save profile</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-zinc-500">Changing your registration details sends your credential back for re-checking.</p>
      </Section>

      {provider && (
        <Section title="Appointments">
          {appts.length === 0 && <p className="text-sm text-zinc-400">No requests yet.</p>}
          <div className="space-y-2">
            {appts.map((a) => {
              const u = userById.get(a.requesterId);
              const actions = availableActions(a.status, "PROVIDER", { now, scheduledAt: a.scheduledAt });
              return (
                <Card key={a.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{u?.name ?? "Client"}</p>
                      <p className="text-xs text-zinc-400">
                        {ist(a.scheduledAt)} IST · {[u?.phone, u?.email].filter(Boolean).join(" · ")}
                      </p>
                      {a.note && <p className="mt-1 whitespace-pre-line text-sm text-zinc-300">{a.note}</p>}
                      {a.status === "CANCELLED" && a.cancelReason && <p className="mt-1 text-xs text-zinc-500">Cancelled: {a.cancelReason}</p>}
                    </div>
                    <Pill tone={a.status === "CONFIRMED" ? "emerald" : a.status === "REQUESTED" ? "amber" : "zinc"}>
                      {isAppointmentStatus(a.status) ? APPOINTMENT_STATUS_LABELS[a.status] : a.status}
                    </Pill>
                  </div>
                  {actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {actions.map((act) => (
                        <form key={act} action={actOnAppointment}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="action" value={act} />
                          <input type="hidden" name="returnTo" value="/wellness/provider" />
                          <button className={act === "CONFIRM" || act === "COMPLETE" ? buttonCls : ghostButtonCls}>{ACTION_LABELS[act]}</button>
                        </form>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </Section>
      )}
    </Page>
  );
}
