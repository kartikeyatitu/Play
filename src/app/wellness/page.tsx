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
  isProviderCategory,
} from "@/lib/wellness";
import { actOnAppointment } from "@/app/actions/wellness";
import { Card, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls, ist } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
// Signed-in only and never indexed: wellness is a sensitive area.
export const metadata: Metadata = { title: "Wellness | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 60) || "";

export default async function WellnessPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.wellness) notFound();
  const session = await requireAuth();
  const sp = await searchParams;
  const category = one(sp.category);
  const city = one(sp.city);

  const [providers, mine] = await Promise.all([
    // Discovery shows public profile fields only — never registration numbers.
    db.wellnessProvider.findMany({
      where: {
        isListed: true,
        ...(isProviderCategory(category) ? { category } : {}),
        ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
      },
      select: { id: true, displayName: true, category: true, city: true, services: true, credentialStatus: true, acceptingRequests: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    db.wellnessAppointment.findMany({ where: { requesterId: session.id }, orderBy: { scheduledAt: "desc" }, take: 50 }),
  ]);
  const providerNames = mine.length
    ? await db.wellnessProvider.findMany({ where: { id: { in: mine.map((a) => a.providerId) } }, select: { id: true, displayName: true } })
    : [];
  const nameById = new Map(providerNames.map((p) => [p.id, p.displayName]));
  const now = new Date();

  return (
    <Page
      eyebrow="Triq Wellness"
      title="Find a wellness professional"
      actions={
        <Link href="/wellness/provider" className={ghostButtonCls}>
          I am a provider
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />
      <p className="mt-3 text-sm text-zinc-400">
        Triq helps you contact physiotherapists, nutritionists, recovery and sports psychology professionals. Triq does not give medical
        advice.
      </p>

      <Section title="My appointment requests">
        {mine.length === 0 && <p className="text-sm text-zinc-400">No requests yet.</p>}
        <div className="space-y-2">
          {mine.map((a) => {
            const actions = availableActions(a.status, "REQUESTER", { now, scheduledAt: a.scheduledAt });
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{nameById.get(a.providerId) ?? "Provider"}</p>
                    <p className="text-xs text-zinc-400">
                      {isProviderCategory(a.category) ? PROVIDER_CATEGORY_LABELS[a.category] : a.category} · {ist(a.scheduledAt)} IST
                    </p>
                  </div>
                  <Pill tone={a.status === "CONFIRMED" ? "emerald" : a.status === "REQUESTED" ? "amber" : "zinc"}>
                    {isAppointmentStatus(a.status) ? APPOINTMENT_STATUS_LABELS[a.status] : a.status}
                  </Pill>
                </div>
                {actions.includes("CANCEL") && (
                  <form action={actOnAppointment} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="action" value="CANCEL" />
                    <input type="hidden" name="returnTo" value="/wellness" />
                    <input name="reason" maxLength={300} placeholder="Reason (optional)" className={`${inputCls} flex-1`} />
                    <button className={ghostButtonCls}>Cancel request</button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Providers">
        <form className="grid gap-2 sm:grid-cols-3" method="get">
          <select name="category" defaultValue={category} className={inputCls}>
            <option value="">All services</option>
            {PROVIDER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PROVIDER_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input name="city" defaultValue={city} placeholder="City" className={inputCls} />
          <button className={buttonCls}>Filter</button>
        </form>
        <div className="mt-3 space-y-2">
          {providers.length === 0 && <p className="text-sm text-zinc-400">No providers listed yet for these filters.</p>}
          {providers.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/wellness/p/${p.id}`} className="font-medium text-white hover:underline">
                    {p.displayName}
                  </Link>
                  <p className="text-xs text-zinc-400">
                    {isProviderCategory(p.category) ? PROVIDER_CATEGORY_LABELS[p.category] : p.category}
                    {p.city ? ` · ${p.city}` : ""}
                  </p>
                  {p.services && <p className="mt-1 text-sm text-zinc-300">{p.services}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Pill tone={p.credentialStatus === "VERIFIED" ? "emerald" : "zinc"}>{credentialLabel(p.credentialStatus)}</Pill>
                  {!p.acceptingRequests && <Pill tone="rose">Not taking requests</Pill>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </Page>
  );
}
