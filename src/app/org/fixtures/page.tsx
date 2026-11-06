import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { checkPermission } from "@/lib/membership";
import { FixturesWorkspace } from "@/components/fixtures/FixturesWorkspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fixtures | Triq", robots: { index: false, follow: false } };

export default async function OrgFixturesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  if (!FEATURES.events || !FEATURES.fixtures) notFound();
  const auth = await checkPermission("competitions.manage");
  const { c } = await searchParams;
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/org?tab=events" className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        {auth.ok ? <FixturesWorkspace initialId={typeof c === "string" && c ? c : null} /> : <p className="text-sm text-danger">{auth.error}</p>}
      </div>
    </div>
  );
}
