import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { listMyGallery } from "@/app/actions/media-assets";
import { MediaFeatureOff } from "@/components/media/FeatureOff";
import { ParentGallery } from "@/components/media/ParentGallery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Photos", robots: { index: false } };

/** Parent gallery: only photos canView allows. Signed-in only; no public URLs. */
export default async function GalleryPage() {
  if (!FEATURES.media) return <MediaFeatureOff />;
  await requireAuth();
  const r = await listMyGallery();
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Photos</h1>
          <p className="text-sm text-ink-muted">From your child&apos;s academy, shared only as parents allow.</p>
        </div>
        <Link href="/gallery/consent" className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink">
          Photo consent
        </Link>
      </header>
      {r.ok ? <ParentGallery items={r.items} /> : <p className="text-sm text-danger">{r.error}</p>}
    </main>
  );
}
