import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { getSession, homePathForRole } from "@/lib/auth";
import { getLiveViewForViewer } from "@/lib/live-match-data";
import { LiveMatchScreen } from "@/components/live/LiveMatchScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live score · TRIQ",
  robots: { index: false, follow: false },
};

export default async function LiveMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  if (!FEATURES.liveScoring) notFound();
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.slice(0, 64) : null;
  const view = await getLiveViewForViewer(id, token);
  if (!view) notFound();

  const session = await getSession();
  const backHref = session
    ? view.staff
      ? session.role === "ADMIN"
        ? "/org/live"
        : "/coach?tab=plan"
      : homePathForRole(String(session.role), true)
    : null;

  return <LiveMatchScreen initial={view} token={token} backHref={backHref} />;
}
