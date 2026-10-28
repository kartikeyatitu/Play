import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { requireMember } from "@/lib/membership";
import { canScoreAs, listLiveMatches } from "@/lib/live-match-data";
import { LiveMatchesPanel } from "@/components/live/LiveMatchesPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live scoring | Triq", robots: { index: false, follow: false } };

export default async function OrgLivePage() {
  if (!FEATURES.liveScoring) notFound();
  const { session, membership } = await requireMember(["ADMIN"]);
  const orgId = session.orgId;
  const [rows, students] = await Promise.all([
    listLiveMatches(orgId, 50),
    db.student.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/org?tab=events" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <LiveMatchesPanel rows={rows} squad={students} canCreate={canScoreAs(membership)} />
      </div>
    </div>
  );
}
