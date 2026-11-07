import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { getMyChildrenMediaConsents } from "@/app/actions/media-consent";
import { ConsentScreen } from "@/components/media/ConsentScreen";
import { MediaFeatureOff } from "@/components/media/FeatureOff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Photo consent", robots: { index: false } };

/** Guardian sets photo consent per child (four scopes). Everything starts off. */
export default async function MediaConsentPage() {
  if (!FEATURES.media) return <MediaFeatureOff />;
  await requireAuth();
  const r = await getMyChildrenMediaConsents();
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pb-24 pt-6">
      <Link href="/gallery" className="text-sm text-ink-muted">← Photos</Link>
      <h1 className="text-xl font-semibold text-ink">Photo consent</h1>
      {r.ok ? <ConsentScreen initial={r.children} noticeVersion={r.noticeVersion} /> : <p className="text-sm text-danger">{r.error}</p>}
    </main>
  );
}
