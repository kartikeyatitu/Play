import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { getRewardsOverview, getRewardsSettings, listPendingBonuses, listRedemptions, listRewardItems } from "@/app/actions/rewards";
import { OwnerRewardsWorkspace } from "@/components/rewards/OwnerRewardsWorkspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rewards | Triq", robots: { index: false, follow: false } };

/** Owner / manager rewards workspace. Coaches use the award sheet and request list on their own screen. */
export default async function OrgRewardsPage() {
  if (!FEATURES.rewards) notFound();
  const [overview, settingsInfo, items, pending, redemptions] = await Promise.all([
    getRewardsOverview(),
    getRewardsSettings(),
    listRewardItems(true),
    listPendingBonuses(),
    listRedemptions(),
  ]);
  const error = [overview, settingsInfo, items, pending, redemptions].find((r) => !r.ok) as { ok: false; error: string } | undefined;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Link href="/org" className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <h1 className="mb-1 text-2xl font-bold text-ink">Rewards</h1>
        <p className="mb-5 text-sm text-ink-muted">XP shows progress and never expires. Points are spent on rewards you offer and expire after 12 months.</p>
        {error || !overview.ok || !settingsInfo.ok || !items.ok || !pending.ok || !redemptions.ok ? (
          <p className="text-sm text-danger">{error?.error ?? "Couldn't load rewards"}</p>
        ) : (
          <OwnerRewardsWorkspace overview={overview} settingsInfo={settingsInfo} items={items.items} pending={pending.pending} redemptions={redemptions.redemptions} />
        )}
      </div>
    </div>
  );
}
