import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { getChildRewards } from "@/app/actions/rewards";
import { ChildRewardsView } from "@/components/rewards/ChildRewardsView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rewards · Triq", robots: { index: false, follow: false } };

/** Parent rewards: one of their own children at a time (Student.parentId = the signed-in parent). */
export default async function ParentRewardsPage(props: { searchParams: Promise<{ child?: string | string[] }> }) {
  if (!FEATURES.rewards) notFound();
  const session = await requireAuth(["PARENT"]);
  const sp = await props.searchParams;
  const pick = Array.isArray(sp.child) ? sp.child[0] : sp.child;
  const kids = await db.student.findMany({
    where: { parentId: session.id, orgId: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const child = kids.find((k) => k.id === pick) ?? kids[0] ?? null;
  const data = child ? await getChildRewards(child.id) : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-xl px-4 py-5">
        <Link href="/parent" className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="mb-3 text-2xl font-bold text-ink">Rewards</h1>
        {kids.length > 1 ? (
          <nav aria-label="Choose child" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
            {kids.map((k) => (
              <Link
                key={k.id}
                href={`/rewards?child=${encodeURIComponent(k.id)}`}
                aria-current={k.id === child?.id ? "page" : undefined}
                className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                  k.id === child?.id ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface text-ink-muted"
                }`}
              >
                {k.name.split(" ")[0]}
              </Link>
            ))}
          </nav>
        ) : null}
        {!child ? <p className="text-sm text-ink-muted">No player linked to your account yet.</p> : null}
        {data && !data.ok ? <p className="text-sm text-danger">{data.error}</p> : null}
        {data && data.ok ? <ChildRewardsView key={data.student.id} data={data} /> : null}
      </div>
    </div>
  );
}
