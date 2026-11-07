import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { requireMember } from "@/lib/membership";
import { listContextMedia, listTaggableStudents } from "@/app/actions/media-assets";
import { MediaFeatureOff } from "@/components/media/FeatureOff";
import { MediaManager } from "@/components/media/MediaManager";
import { isMediaContextType, MEDIA_CONTEXT_LABELS, type MediaContextType } from "@/lib/media/constants";
import { canUploadMedia } from "@/lib/media/policy";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Photos", robots: { index: false } };

/** Academy photos per context: /org/media?context=SESSION&id=<sessionId>. Defaults to the academy gallery. */
export default async function OrgMediaPage({ searchParams }: { searchParams: Promise<{ context?: string; id?: string }> }) {
  if (!FEATURES.media) return <MediaFeatureOff />;
  const { session, membership } = await requireMember(["ADMIN", "COACH", "STAFF"]);
  const orgId = session.orgId;
  const sp = await searchParams;
  const contextType: MediaContextType = isMediaContextType(sp.context) ? sp.context : "GALLERY";
  const contextId = contextType === "GALLERY" ? null : sp.id ? String(sp.id) : null;
  if (contextType !== "GALLERY" && !contextId) notFound();

  const canUpload = canUploadMedia(membership);
  const [media, students, sessions, competitions] = await Promise.all([
    listContextMedia({ contextType, contextId }),
    canUpload ? listTaggableStudents() : Promise.resolve(null),
    db.session.findMany({
      where: { batch: { orgId, ...(membership.role === "COACH" ? { coachId: session.id } : {}) }, date: { lte: new Date() } },
      orderBy: { date: "desc" },
      take: 6,
      select: { id: true, date: true, batch: { select: { name: true } } },
    }),
    db.competition.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, name: true } }),
  ]);
  if (!media.ok) return <p className="p-6 text-sm text-danger">{media.error}</p>;

  const contexts = [
    { href: "/org/media", label: MEDIA_CONTEXT_LABELS.GALLERY, active: contextType === "GALLERY" },
    ...sessions.map((s) => ({
      href: `/org/media?context=SESSION&id=${s.id}`,
      label: `${s.batch.name} · ${s.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      active: contextType === "SESSION" && contextId === s.id,
    })),
    ...competitions.map((c) => ({
      href: `/org/media?context=TOURNAMENT&id=${c.id}`,
      label: c.name,
      active: contextType === "TOURNAMENT" && contextId === c.id,
    })),
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">Photos</h1>
        <p className="text-sm text-ink-muted">
          Private to academy staff. Parents see a photo only when every tagged child&apos;s guardian has allowed it.
        </p>
      </header>
      <nav aria-label="Where these photos belong" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {contexts.map((c) => (
            <li key={c.href} className="shrink-0">
              <Link href={c.href} aria-current={c.active ? "page" : undefined}
                className={cn("inline-flex min-h-[40px] items-center rounded-full border px-3 text-sm",
                  c.active ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface text-ink")}>
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <MediaManager
        key={`${contextType}:${contextId ?? ""}`}
        contextType={contextType}
        contextId={contextId}
        initialItems={media.items}
        students={students && students.ok ? students.students : []}
        canUpload={canUpload}
        canDeleteAny={membership.role === "OWNER" || membership.role === "MANAGER"}
      />
    </main>
  );
}
