import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { REPORT_REASON_LABELS, isReportReason } from "@/lib/creators";
import { resolveReport, setContentHidden } from "./actions";
import { Card, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, istDate } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ops · Content reports | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function OpsReportsPage({ searchParams }: { searchParams: SP }) {
  await requireAuth(["SUPER_ADMIN"]);
  const sp = await searchParams;
  if (!FEATURES.creators) {
    return (
      <Page eyebrow="Triq ops" title="Content reports">
        <p className="mt-4 text-sm text-zinc-500">Creators is switched off.</p>
      </Page>
    );
  }

  const [open, hiddenProfiles, hiddenItems] = await Promise.all([
    db.contentReport.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 100 }),
    db.creatorProfile.findMany({ where: { hiddenAt: { not: null } }, select: { id: true, handle: true, displayName: true, hiddenAt: true }, take: 50 }),
    db.creatorPortfolioItem.findMany({ where: { hiddenAt: { not: null } }, select: { id: true, title: true, url: true, creatorId: true, hiddenAt: true }, take: 50 }),
  ]);
  const creatorIds = Array.from(new Set([...open.map((r) => r.creatorId), ...hiddenItems.map((i) => i.creatorId)]));
  const itemIds = open.filter((r) => r.targetType === "PORTFOLIO_ITEM").map((r) => r.targetId);
  const [creators, items] = await Promise.all([
    creatorIds.length ? db.creatorProfile.findMany({ where: { id: { in: creatorIds } }, select: { id: true, handle: true, displayName: true } }) : [],
    itemIds.length ? db.creatorPortfolioItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, title: true, url: true } }) : [],
  ]);
  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  return (
    <Page eyebrow="Triq ops" title="Content reports">
      <Flash error={sp.error} saved={sp.saved} />
      <Section title={`Open reports (${open.length})`}>
        {open.length === 0 && <p className="text-sm text-zinc-400">Nothing to review.</p>}
        <div className="space-y-2">
          {open.map((r) => {
            const c = creatorById.get(r.creatorId);
            const item = itemById.get(r.targetId);
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">
                      {r.targetType === "CREATOR_PROFILE" ? "Profile" : "Link"} ·{" "}
                      {c ? (
                        <Link href={`/creators/${c.handle}`} className="hover:underline">
                          {c.displayName} (@{c.handle})
                        </Link>
                      ) : (
                        "unknown creator"
                      )}
                    </p>
                    {item && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-lime-300 hover:underline">
                        {item.title}
                      </a>
                    )}
                    {r.details && <p className="mt-1 text-sm text-zinc-300">{r.details}</p>}
                    <p className="text-xs text-zinc-500">reported {istDate(r.createdAt)}</p>
                  </div>
                  <Pill tone="rose">{isReportReason(r.reason) ? REPORT_REASON_LABELS[r.reason] : r.reason}</Pill>
                </div>
                <div className="mt-2 flex gap-2">
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="HIDE" />
                    <button className={buttonCls}>Hide content</button>
                  </form>
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="DISMISS" />
                    <button className={ghostButtonCls}>Dismiss</button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Hidden content">
        {hiddenProfiles.length + hiddenItems.length === 0 && <p className="text-sm text-zinc-400">Nothing hidden.</p>}
        <div className="space-y-2">
          {hiddenProfiles.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-white">
                  Profile {p.displayName} (@{p.handle}) · hidden {p.hiddenAt ? istDate(p.hiddenAt) : ""}
                </p>
                <form action={setContentHidden}>
                  <input type="hidden" name="targetType" value="CREATOR_PROFILE" />
                  <input type="hidden" name="targetId" value={p.id} />
                  <input type="hidden" name="hidden" value="0" />
                  <button className={ghostButtonCls}>Unhide</button>
                </form>
              </div>
            </Card>
          ))}
          {hiddenItems.map((i) => (
            <Card key={i.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-white">
                  Link “{i.title}” by @{creatorById.get(i.creatorId)?.handle ?? "?"} · hidden {i.hiddenAt ? istDate(i.hiddenAt) : ""}
                </p>
                <form action={setContentHidden}>
                  <input type="hidden" name="targetType" value="PORTFOLIO_ITEM" />
                  <input type="hidden" name="targetId" value={i.id} />
                  <input type="hidden" name="hidden" value="0" />
                  <button className={ghostButtonCls}>Unhide</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </Page>
  );
}
