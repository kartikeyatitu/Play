import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { CREATOR_CATEGORY_LABELS, REPORT_REASONS, REPORT_REASON_LABELS, isCreatorCategory, isProfileVisible, istDayStart } from "@/lib/creators";
import { reportContent } from "@/app/actions/creators";
import { Card, Flash, Page, Pill, Section, ghostButtonCls, inputCls } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";

type Params = Promise<{ handle: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

const loadCreator = cache(async (handle: string) => {
  if (!/^[a-z0-9_]{3,30}$/.test(handle)) return null;
  return db.creatorProfile.findUnique({ where: { handle } });
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!FEATURES.creators) return { title: "Not found | Triq" };
  const { handle } = await params;
  const c = await loadCreator(handle);
  if (!c || !isProfileVisible(c)) return { title: "Creator not found | Triq", robots: { index: false } };
  return { title: `${c.displayName} (@${c.handle}) | Triq Creators`, description: c.bio?.slice(0, 160) || undefined };
}

function ReportForm({ targetType, targetId, handle, label }: { targetType: string; targetId: string; handle: string; label: string }) {
  return (
    <details className="mt-2 text-xs text-zinc-500">
      <summary className="cursor-pointer hover:text-zinc-300">{label}</summary>
      <form action={reportContent} className="mt-2 flex flex-wrap gap-2">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="handle" value={handle} />
        <select name="reason" className={`${inputCls} w-auto`} defaultValue="SPAM">
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REPORT_REASON_LABELS[r]}
            </option>
          ))}
        </select>
        <input name="details" maxLength={1000} placeholder="Details (optional)" className={`${inputCls} flex-1`} />
        <button className={ghostButtonCls}>Report</button>
      </form>
    </details>
  );
}

export default async function CreatorPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  if (!FEATURES.creators) notFound();
  const { handle } = await params;
  const sp = await searchParams;
  const c = await loadCreator(handle);
  if (!c) notFound();
  const session = await getSession();
  const isOwner = session?.id === c.userId;
  if (!isProfileVisible(c) && !isOwner) notFound();

  const [items, coach, org] = await Promise.all([
    db.creatorPortfolioItem.findMany({ where: { creatorId: c.id, ...(isOwner ? {} : { hiddenAt: null }) }, orderBy: { createdAt: "desc" } }),
    c.linkCoachPage
      ? db.user.findFirst({ where: { id: c.userId, role: { in: ["COACH", "ADMIN"] }, orgId: { not: null } }, select: { id: true } })
      : null,
    c.linkedOrgId ? db.organization.findFirst({ where: { id: c.linkedOrgId, isActive: true }, select: { name: true, slug: true } }) : null,
  ]);

  // Analytics from real events only: record this view unless it is the owner. Signed-in viewers count
  // once per IST day; anonymous renders count each time. Never blocks rendering.
  if (!isOwner && isProfileVisible(c)) {
    try {
      const viewerId = session?.id ? String(session.id) : null;
      const seen = viewerId
        ? await db.creatorProfileView.findFirst({ where: { creatorId: c.id, viewerId, createdAt: { gte: istDayStart(new Date()) } }, select: { id: true } })
        : null;
      if (!seen) await db.creatorProfileView.create({ data: { creatorId: c.id, viewerId } });
    } catch (e: any) {
      console.error("[creators] view record failed", e?.message);
    }
  }

  return (
    <Page
      eyebrow={`@${c.handle}`}
      title={c.displayName}
      actions={
        <Link href="/creators" className={ghostButtonCls}>
          All creators
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />
      {sp.reported && <p className="mt-4 text-sm text-emerald-300">Thanks — our team will review your report.</p>}
      {isOwner && !isProfileVisible(c) && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {c.hiddenAt ? "This profile has been hidden by Triq moderators." : "Only you can see this profile. Make it public from your creator settings."}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-1">
        {c.categories.filter(isCreatorCategory).map((k) => (
          <Pill key={k} tone="lime">
            {CREATOR_CATEGORY_LABELS[k]}
          </Pill>
        ))}
        {c.sports.map((s) => (
          <Pill key={s}>{s}</Pill>
        ))}
        {c.city && <Pill>{c.city}</Pill>}
      </div>
      {c.bio && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-200">{c.bio}</p>}

      {(coach || org) && (
        <Section title="On Triq">
          <div className="flex flex-wrap gap-3 text-sm">
            {coach && (
              <Link href={`/c/${coach.id}`} className="text-lime-300 hover:underline">
                Coach profile
              </Link>
            )}
            {org && (
              <Link href={`/academy/${org.slug}`} className="text-lime-300 hover:underline">
                {org.name}
              </Link>
            )}
          </div>
        </Section>
      )}

      <Section title="Portfolio">
        {items.length === 0 && <p className="text-sm text-zinc-400">No links yet.</p>}
        <div className="space-y-2">
          {items.map((i) => (
            <Card key={i.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <a href={i.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium text-white hover:underline">
                    {i.title}
                  </a>
                  {i.description && <p className="text-sm text-zinc-300">{i.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Pill>{i.platform}</Pill>
                  {i.hiddenAt && <Pill tone="rose">Hidden by moderators</Pill>}
                </div>
              </div>
              {session && !isOwner && <ReportForm targetType="PORTFOLIO_ITEM" targetId={i.id} handle={c.handle} label="Report this link" />}
            </Card>
          ))}
        </div>
      </Section>

      {session && !isOwner && (
        <div className="mt-8">
          <ReportForm targetType="CREATOR_PROFILE" targetId={c.id} handle={c.handle} label="Report this profile" />
        </div>
      )}
    </Page>
  );
}
