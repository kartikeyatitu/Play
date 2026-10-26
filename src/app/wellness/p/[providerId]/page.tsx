import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { credentialLabel } from "@/lib/credentials";
import { PROVIDER_CATEGORY_LABELS, isProviderCategory } from "@/lib/wellness";
import { requestAppointment } from "@/app/actions/wellness";
import { Field, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wellness provider | Triq", robots: { index: false, follow: false } };

type Params = Promise<{ providerId: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProviderPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  if (!FEATURES.wellness) notFound();
  const session = await requireAuth();
  const { providerId } = await params;
  const sp = await searchParams;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(providerId)) notFound();
  const p = await db.wellnessProvider.findFirst({
    where: { id: providerId, isListed: true },
    select: {
      id: true,
      userId: true,
      displayName: true,
      category: true,
      services: true,
      bio: true,
      city: true,
      registrationBody: true,
      credentialStatus: true,
      acceptingRequests: true,
    },
  });
  if (!p) notFound();
  const isSelf = p.userId === session.id;

  return (
    <Page
      eyebrow={isProviderCategory(p.category) ? PROVIDER_CATEGORY_LABELS[p.category] : p.category}
      title={p.displayName}
      actions={
        <Link href="/wellness" className={ghostButtonCls}>
          All providers
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Pill tone={p.credentialStatus === "VERIFIED" ? "emerald" : "zinc"}>{credentialLabel(p.credentialStatus)}</Pill>
        {p.registrationBody && <Pill>Registered with {p.registrationBody}</Pill>}
        {p.city && <Pill>{p.city}</Pill>}
      </div>
      {p.services && (
        <Section title="Services">
          <p className="whitespace-pre-line text-sm text-zinc-200">{p.services}</p>
        </Section>
      )}
      {p.bio && (
        <Section title="About">
          <p className="whitespace-pre-line text-sm text-zinc-200">{p.bio}</p>
        </Section>
      )}
      <Section title="Request an appointment">
        {isSelf ? (
          <p className="text-sm text-zinc-400">This is your own profile.</p>
        ) : !p.acceptingRequests ? (
          <p className="text-sm text-zinc-400">This provider is not taking new requests right now.</p>
        ) : (
          <form action={requestAppointment} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="providerId" value={p.id} />
            <Field label="Preferred date and time (IST)">
              <input type="datetime-local" name="scheduledAt" required className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note for the provider (optional, only they can see it)">
                <textarea name="note" rows={3} maxLength={500} className={inputCls} placeholder="e.g. preferred language, sport" />
              </Field>
              <p className="mt-1 text-xs text-zinc-500">
                Don&apos;t share detailed medical history here; discuss it directly with the provider.
              </p>
            </div>
            <div>
              <button className={buttonCls}>Send request</button>
            </div>
          </form>
        )}
      </Section>
    </Page>
  );
}
