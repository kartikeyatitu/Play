import { notFound } from "next/navigation";
import { ensureTeamSchema } from "@/lib/schema-ensure";
import { db } from "@/lib/db";
import { MapPin, Users, Trophy, Calendar } from "lucide-react";
import Link from "next/link";
import { SportIcon } from "@/components/sport/SportIcon";
import { VenueMap } from "@/components/maps/VenueMap";
import { Reveal } from "@/components/motion/Reveal";

export default async function AcademyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await ensureTeamSchema();
  const org = await db.organization.findUnique({
    where: { slug },
    include: {
      batches: true,
      // Public page: only counts — never load student rows or coach user rows (phone, password hash)
      _count: {
        select: {
          students: true,
          memberships: { where: { role: "COACH", status: "ACTIVE" } },
        },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const sports = Array.from(new Set(org.batches.map(b => b.sport).filter(Boolean)));
  const coachCount = org._count.memberships;
  const studentCount = org._count.students;

  const place = [org.address, org.city, org.state, org.pincode].filter(Boolean).join(", ");
  const hero = org.photos?.[0] ?? null;
  const heroStyle =
    hero && /^https:\/\/[^\s"'()<>\\]+$/.test(hero)
      ? { backgroundImage: `url("${hero}")`, backgroundSize: "cover", backgroundPosition: "center" }
      : { background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 45%, #0b241a))" };

  return (
    <div className="min-h-screen bg-canvas pb-24 text-ink md:pb-0">
      {/* Hero: the academy's own photo, full width, with the name over it */}
      <header className="relative flex min-h-[340px] items-end sm:min-h-[420px]" style={heroStyle}>
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#000000d9] via-[#00000066] to-[#0000001a]" />
        <div className="relative mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-end gap-4">
              {org.logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={org.logo} alt="" className="h-16 w-16 shrink-0 rounded-2xl border-2 border-[#ffffffcc] object-cover shadow-lg sm:h-20 sm:w-20" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#fffffff2] text-2xl font-black text-[#13261e] shadow-lg sm:h-20 sm:w-20">
                  {org.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#ffffff] sm:text-5xl">{org.name}</h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#ffffffd9]">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {org.city}</span>
                  {studentCount > 0 && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden /> {studentCount} athletes</span>}
                  {coachCount > 0 && <span className="inline-flex items-center gap-1.5"><Trophy className="h-4 w-4" aria-hidden /> {coachCount} coaches</span>}
                </p>
              </div>
            </div>
            {sports.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {sports.map((sport) => (
                  <li key={sport} className="inline-flex items-center gap-1.5 rounded-full bg-[#ffffff26] px-3 py-1.5 text-sm font-medium text-[#ffffff] backdrop-blur">
                    <SportIcon sport={sport.toLowerCase().replace(/\s+/g, "_")} className="h-4 w-4" /> {sport}
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>
      </header>

      {/* More photos, swipeable */}
      {org.photos && org.photos.length > 1 && (
        <section aria-label="Photos" className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {org.photos.slice(1).map((url, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={url}
                src={url}
                alt={`${org.name}, photo ${i + 2}`}
                loading="lazy"
                className="h-48 w-72 shrink-0 snap-start rounded-2xl object-cover shadow-md sm:h-60 sm:w-96"
              />
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div className="space-y-10 md:col-span-2">
          <section>
            <h2 className="text-2xl font-bold tracking-tight">Programs</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {org.batches.length > 0 ? (
                org.batches.map((batch, i) => (
                  <Reveal key={batch.id} delay={Math.min(i, 6) * 0.05}>
                    <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-bg">
                        <SportIcon sport={(batch.sport || "").toLowerCase().replace(/\s+/g, "_")} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug">{batch.name}</h3>
                        {batch.sport && <p className="text-sm text-ink-muted">{batch.sport}</p>}
                        {batch.schedule && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                            <Calendar className="h-4 w-4 shrink-0" aria-hidden /> {batch.schedule}
                          </p>
                        )}
                      </div>
                    </div>
                  </Reveal>
                ))
              ) : (
                <p className="text-ink-muted">No programs listed yet.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight">About</h2>
            <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
              {org.name} trains young athletes in {org.city}
              {sports.length ? ` in ${sports.join(", ")}` : ""}. Book a free trial to see a session, meet the coaches and find the right batch.
            </p>
          </section>
        </div>

        <aside className="space-y-4">
          {place && <VenueMap place={place} label={org.name} />}
          {(org.phone || org.email) && (
            <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
              <h3 className="font-semibold">Contact</h3>
              {org.phone && <a href={`tel:${org.phone}`} className="mt-2 block text-ink-muted hover:text-ink">{org.phone}</a>}
              {org.email && <a href={`mailto:${org.email}`} className="mt-1 block text-ink-muted hover:text-ink">{org.email}</a>}
            </div>
          )}
          <div className="hidden rounded-2xl border border-line bg-surface p-4 md:block">
            <h3 className="font-semibold">Come and play</h3>
            <p className="mt-1 text-sm text-ink-muted">Book a free trial, or enrol straight away.</p>
            <div className="mt-4 grid gap-2">
              <Link href={`/trial?academy=${org.slug}`} className="inline-flex h-11 items-center justify-center rounded-xl brand-bg font-semibold">Book a free trial</Link>
              <Link href={`/join?academy=${org.slug}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-line font-semibold hover:bg-surface-2">Enrol</Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Phones: actions stay within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Link href={`/trial?academy=${org.slug}`} className="inline-flex h-12 flex-1 items-center justify-center rounded-xl brand-bg font-semibold">Book a free trial</Link>
          <Link href={`/join?academy=${org.slug}`} className="inline-flex h-12 items-center justify-center rounded-xl border border-line px-5 font-semibold">Enrol</Link>
        </div>
      </div>
    </div>
  );
}
