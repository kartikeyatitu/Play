import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { shortStart } from "@/lib/coach";
import { scheduleRunsOn } from "@/lib/fees";
import { getAppUrl } from "@/lib/app-url";
import { BadgeCheck, MapPin, CalendarDays, Clock, Users, ChevronRight, Sparkles } from "lucide-react";

// PUBLIC (no auth). Only public-safe fields are selected: no phones, emails,
// student names or medical data — enrollments are only ever counted.

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const getCoachProfile = cache(async (coachId: string) => {
  if (!coachId || coachId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(coachId)) return null;
  const coach = await db.user.findFirst({
    where: { id: coachId, role: { in: ["COACH", "ADMIN"] }, orgId: { not: null } },
    select: {
      id: true,
      name: true,
      role: true,
      verified: true,
      orgId: true,
      org: {
        select: {
          name: true,
          slug: true,
          city: true,
          state: true,
          logo: true,
          isActive: true,
          brandColor: true,
          hidePoweredBy: true,
        },
      },
    },
  });
  if (!coach || !coach.org || !coach.orgId || !coach.org.isActive) return null;

  const batches = await db.batch.findMany({
    where: { coachId: coach.id, orgId: coach.orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      sport: true,
      schedule: true,
      monthlyFee: true,
      capacity: true,
      _count: { select: { enrollments: true } },
    },
  });

  return { coach, org: coach.org, batches };
});

function initials(name: string) {
  return (
    name
      .replace(/^(coach|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, "")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "C"
  );
}

function scheduleDays(schedule: string | null) {
  if (!schedule) return null;
  const days = WEEK.filter((d) => scheduleRunsOn(schedule, d) === true);
  if (days.length === 0) return null;
  return days.length === 7 ? "Daily" : days.join(" · ");
}

function scheduleClock(schedule: string | null) {
  if (!schedule) return null;
  const m = schedule.match(/\d{1,2}(?::\d{2})?\s*(?:-\s*\d{1,2}(?::\d{2})?\s*)?(?:am|pm)/i);
  if (m) return m[0].toUpperCase().replace(/\s+/g, " ");
  const t = shortStart(schedule);
  return t ? `${t.time} ${t.period}` : null;
}

export async function generateMetadata({ params }: { params: Promise<{ coachId: string }> }): Promise<Metadata> {
  const { coachId } = await params;
  const data = await getCoachProfile(coachId);
  if (!data) return { title: "Coach not found | Triq" };
  const { coach, org, batches } = data;
  const sports = Array.from(new Set(batches.map((b) => b.sport).filter(Boolean)));
  const title = `${coach.name} · ${org.name}`;
  const description = `${sports.length ? `${sports.join(", ")} coach` : "Coach"} at ${org.name}${
    org.city ? `, ${org.city}` : ""
  }. See batches & timings and book a free trial.`;
  return {
    title: `${title} | Triq`,
    description,
    openGraph: { title, description, type: "profile", ...(org.logo ? { images: [{ url: org.logo }] } : {}) },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicCoachProfilePage({ params }: { params: Promise<{ coachId: string }> }) {
  const { coachId } = await params;
  const data = await getCoachProfile(coachId);
  if (!data) notFound();
  const { coach, org, batches } = data;

  const sports = Array.from(new Set(batches.map((b) => b.sport).filter(Boolean)));
  const trialHref = (batchId?: string) =>
    `/trial?academy=${encodeURIComponent(org.slug)}${batchId ? `&batch=${encodeURIComponent(batchId)}` : ""}`;
  const brand = org.brandColor && /^#[0-9a-fA-F]{6}$/.test(org.brandColor) ? org.brandColor : null;
  const shellStyle = (brand ? { "--brand": brand } : {}) as CSSProperties;
  const location = [org.city, org.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans overflow-x-hidden" style={shellStyle}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60"
        style={{ background: "radial-gradient(60% 100% at 80% 0%, color-mix(in srgb, var(--brand) 22%, transparent), transparent)" }}
        aria-hidden
      />

      <main className="relative max-w-lg mx-auto px-4 pt-8 pb-32 space-y-5">
        {/* Academy strip */}
        <div className="flex items-center gap-2.5 min-w-0">
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt="" className="w-8 h-8 rounded-lg object-cover border border-zinc-800 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-black text-[var(--brand)] shrink-0">
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <Link href={`/academy/${org.slug}`} className="text-sm font-semibold text-zinc-300 hover:text-white truncate">
            {org.name}
          </Link>
        </div>

        {/* Coach hero */}
        <section className="rounded-3xl bg-zinc-900/70 border border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--brand)] to-emerald-500 flex items-center justify-center text-zinc-950 font-black text-3xl shrink-0">
              {initials(coach.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black tracking-tight text-white leading-tight break-words">{coach.name}</h1>
              <p className="text-sm text-zinc-400 mt-0.5">{coach.role === "ADMIN" ? "Head coach" : "Coach"} · {org.name}</p>
              {coach.verified && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verified coach
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--brand)]" /> {location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-[var(--brand)]" /> {batches.length} {batches.length === 1 ? "batch" : "batches"}
            </span>
          </div>

          {sports.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sports.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs font-semibold text-zinc-200">
                  {s}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Batches */}
        <section className="space-y-2.5">
          <h2 className="text-sm font-bold text-white px-1">Batches &amp; timings</h2>
          {batches.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-5 text-sm text-zinc-400">
              Batch timings coming soon. Book a free trial and the academy will suggest the right batch.
            </div>
          ) : (
            batches.map((b) => {
              const days = scheduleDays(b.schedule);
              const clock = scheduleClock(b.schedule);
              const spotsLeft = b.capacity != null ? Math.max(0, b.capacity - b._count.enrollments) : null;
              return (
                <Link
                  key={b.id}
                  href={trialHref(b.id)}
                  className="block rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 p-4 transition-colors min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-base font-bold text-white leading-snug break-words">{b.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                        <span className="font-semibold text-zinc-300">{b.sport}</span>
                        {days && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" /> {days}
                          </span>
                        )}
                        {clock && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {clock}
                          </span>
                        )}
                        {!days && !clock && b.schedule && <span className="break-words">{b.schedule}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {b.monthlyFee != null && b.monthlyFee > 0 && (
                          <span className="text-xs font-semibold text-zinc-200">
                            {b.monthlyFee.toLocaleString()}
                            <span className="text-zinc-500 font-normal">/month</span>
                          </span>
                        )}
                        {spotsLeft != null &&
                          (spotsLeft === 0 ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              Full · waitlist
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                spotsLeft <= 5
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                              }`}
                            >
                              <Users className="w-3 h-3" /> {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
                            </span>
                          ))}
                      </div>
                    </div>
                    <span className="shrink-0 self-center text-xs font-bold text-[var(--brand)] flex items-center gap-0.5">
                      Try <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </section>

        {!org.hidePoweredBy && (
          <p className="text-center text-[11px] text-zinc-600 pt-4">
            Powered by{" "}
            <a href={getAppUrl()} className="font-black text-zinc-400 hover:text-white">
              Triq
            </a>
          </p>
        )}
      </main>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto px-4">
          <Link
            href={trialHref(batches.length === 1 ? batches[0].id : undefined)}
            className="h-14 w-full rounded-2xl bg-[var(--brand)] text-[var(--brand-foreground)] text-base font-black flex items-center justify-center gap-2 shadow-lg shadow-black/40 hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-5 h-5" /> Book a free trial
          </Link>
          <p className="text-center text-[11px] text-zinc-500 mt-2">Free trial class · the academy confirms your slot</p>
        </div>
      </div>
    </div>
  );
}
