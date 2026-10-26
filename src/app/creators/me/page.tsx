import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { CREATOR_CATEGORIES, CREATOR_CATEGORY_LABELS, MAX_PORTFOLIO_ITEMS } from "@/lib/creators";
import { addPortfolioItem, removePortfolioItem, saveCreatorProfile } from "@/app/actions/creators";
import { Card, Field, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My creator profile | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function CreatorMePage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.creators) notFound();
  const session = await requireAuth();
  const sp = await searchParams;
  const userId = session.id as string;

  const profile = await db.creatorProfile.findUnique({ where: { userId } });
  const now = Date.now();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const [items, views7, views30, memberships] = await Promise.all([
    profile ? db.creatorPortfolioItem.findMany({ where: { creatorId: profile.id }, orderBy: { createdAt: "desc" } }) : [],
    profile ? db.creatorProfileView.count({ where: { creatorId: profile.id, createdAt: { gte: since7 } } }) : 0,
    profile ? db.creatorProfileView.count({ where: { creatorId: profile.id, createdAt: { gte: since30 } } }) : 0,
    db.orgMembership.findMany({ where: { userId, status: "ACTIVE" }, select: { orgId: true } }),
  ]);
  const orgIds = Array.from(new Set([...memberships.map((m) => m.orgId), ...(session.orgId ? [session.orgId] : [])]));
  const orgs = orgIds.length ? await db.organization.findMany({ where: { id: { in: orgIds }, isActive: true }, select: { id: true, name: true } }) : [];
  const canLinkCoach = session.role === "COACH" || session.role === "ADMIN";

  return (
    <Page
      eyebrow="Triq Creators"
      title="My creator profile"
      actions={
        <>
          {profile && (
            <Link href={`/creators/${profile.handle}`} className={ghostButtonCls}>
              View my page
            </Link>
          )}
          <Link href="/creators" className={ghostButtonCls}>
            Discover
          </Link>
        </>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />
      {profile?.hiddenAt && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Your profile has been hidden by Triq moderators after a report. Contact support if you think this is a mistake.
        </p>
      )}

      {profile && (
        <Section title="Profile views (recorded on Triq)">
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <Card>
              <p className="text-2xl font-semibold text-white">{views7}</p>
              <p className="text-xs text-zinc-400">last 7 days</p>
            </Card>
            <Card>
              <p className="text-2xl font-semibold text-white">{views30}</p>
              <p className="text-xs text-zinc-400">last 30 days</p>
            </Card>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Counts views of your Triq page by other people (signed-in visitors once per day). Views on YouTube, Instagram etc. are not included.
          </p>
        </Section>
      )}

      <Section title="Profile">
        <form action={saveCreatorProfile} className="grid gap-3 sm:grid-cols-2">
          <Field label="Handle">
            <input name="handle" required maxLength={31} defaultValue={profile?.handle ?? ""} placeholder="e.g. spin_doctor" className={inputCls} />
          </Field>
          <Field label="Display name">
            <input name="displayName" required maxLength={80} defaultValue={profile?.displayName ?? session.name ?? ""} className={inputCls} />
          </Field>
          <Field label="Sports (comma separated)">
            <input name="sports" defaultValue={profile?.sports.join(", ") ?? ""} className={inputCls} />
          </Field>
          <Field label="City">
            <input name="city" maxLength={80} defaultValue={profile?.city ?? ""} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Bio">
              <textarea name="bio" rows={3} maxLength={1000} defaultValue={profile?.bio ?? ""} className={inputCls} />
            </Field>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-medium text-zinc-400">Content categories (up to 5)</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {CREATOR_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1 text-sm text-zinc-300">
                  <input type="checkbox" name="categories" value={c} defaultChecked={profile?.categories.includes(c) ?? false} />
                  {CREATOR_CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Link an academy or venue you belong to">
            <select name="linkedOrgId" defaultValue={profile?.linkedOrgId ?? ""} className={inputCls}>
              <option value="">None</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          {canLinkCoach && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" name="linkCoachPage" defaultChecked={profile?.linkCoachPage ?? false} /> Link my Triq coach page
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
            <input type="checkbox" name="isPublic" defaultChecked={profile?.isPublic ?? false} /> Show my creator page publicly
          </label>
          <div>
            <button className={buttonCls}>Save profile</button>
          </div>
        </form>
      </Section>

      {profile && (
        <Section title={`Portfolio (${items.length}/${MAX_PORTFOLIO_ITEMS})`}>
          <div className="space-y-2">
            {items.map((i) => (
              <Card key={i.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-white hover:underline">
                      {i.title}
                    </a>
                    <div className="mt-1 flex gap-1">
                      <Pill>{i.platform}</Pill>
                      {i.hiddenAt && <Pill tone="rose">Hidden by moderators</Pill>}
                    </div>
                  </div>
                  <form action={removePortfolioItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="text-xs text-zinc-500 hover:text-rose-300">Remove</button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
          <form action={addPortfolioItem} className="mt-3 grid gap-2 sm:grid-cols-3">
            <input name="title" required maxLength={120} placeholder="Title" className={inputCls} />
            <input name="url" required placeholder="https://youtube.com/…" className={inputCls} />
            <input name="description" maxLength={300} placeholder="Short description (optional)" className={inputCls} />
            <button className={ghostButtonCls}>Add link</button>
          </form>
        </Section>
      )}
    </Page>
  );
}
