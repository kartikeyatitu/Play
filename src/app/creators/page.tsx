import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { CREATOR_CATEGORIES, CREATOR_CATEGORY_LABELS, isCreatorCategory } from "@/lib/creators";
import { Card, Page, Pill, buttonCls, ghostButtonCls, inputCls } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sports creators | Triq",
  description: "Discover sports creators, coaches and analysts and the content they make.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 60) || "";

// PUBLIC: only isPublic, non-hidden profiles; no contact details, no invented metrics.
export default async function CreatorsPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.creators) notFound();
  const sp = await searchParams;
  const sport = one(sp.sport);
  const category = one(sp.category);

  const creators = await db.creatorProfile.findMany({
    where: {
      isPublic: true,
      hiddenAt: null,
      ...(isCreatorCategory(category) ? { categories: { has: category } } : {}),
      ...(sport ? { sports: { has: sport } } : {}),
    },
    select: { id: true, handle: true, displayName: true, city: true, sports: true, categories: true, bio: true },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  return (
    <Page
      eyebrow="Triq Creators"
      title="Sports creators"
      actions={
        <Link href="/creators/me" className={ghostButtonCls}>
          My creator profile
        </Link>
      }
    >
      <form className="mt-6 grid gap-2 sm:grid-cols-3" method="get">
        <input name="sport" defaultValue={sport} placeholder="Sport (exact, e.g. Cricket)" className={inputCls} />
        <select name="category" defaultValue={category} className={inputCls}>
          <option value="">All content</option>
          {CREATOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CREATOR_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <button className={buttonCls}>Filter</button>
      </form>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {creators.length === 0 && <p className="text-sm text-zinc-400">No creators match yet.</p>}
        {creators.map((c) => (
          <Card key={c.id}>
            <Link href={`/creators/${c.handle}`} className="font-semibold text-white hover:underline">
              {c.displayName}
            </Link>
            <p className="text-xs text-zinc-500">
              @{c.handle}
              {c.city ? ` · ${c.city}` : ""}
            </p>
            {c.bio && <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{c.bio}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
              {c.categories.filter(isCreatorCategory).map((k) => (
                <Pill key={k} tone="lime">
                  {CREATOR_CATEGORY_LABELS[k]}
                </Pill>
              ))}
              {c.sports.map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
