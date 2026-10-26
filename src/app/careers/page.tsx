import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS, JOB_ROLE_LABELS, isEmploymentType, isJobRole, payBand } from "@/lib/careers";
import { Card, Page, Pill, buttonCls, ghostButtonCls, inputCls, istDate } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sports jobs | Triq Careers",
  description: "Coaching and sports-industry jobs at academies, clubs and venues.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 60) || "";

// PUBLIC: only OPEN jobs and public organisation fields (name, slug, city). No applicant data.
export default async function CareersPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.careers) notFound();
  const sp = await searchParams;
  const sport = one(sp.sport);
  const city = one(sp.city);
  const type = one(sp.type);

  const jobs = await db.jobListing.findMany({
    where: {
      status: "OPEN",
      ...(sport ? { sport: { contains: sport, mode: "insensitive" as const } } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
      ...(isEmploymentType(type) ? { employmentType: type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const orgs = jobs.length
    ? await db.organization.findMany({
        where: { id: { in: Array.from(new Set(jobs.map((j) => j.orgId))) }, isActive: true },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const visible = jobs.filter((j) => orgById.has(j.orgId));

  return (
    <Page
      eyebrow="Triq Careers"
      title="Sports jobs"
      actions={
        <Link href="/careers/me" className={ghostButtonCls}>
          My profile & applications
        </Link>
      }
    >
      <form className="mt-6 grid gap-2 sm:grid-cols-4" method="get">
        <input name="sport" defaultValue={sport} placeholder="Sport" className={inputCls} />
        <input name="city" defaultValue={city} placeholder="City" className={inputCls} />
        <select name="type" defaultValue={type} className={inputCls}>
          <option value="">Any type</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EMPLOYMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button className={buttonCls}>Filter</button>
      </form>

      <div className="mt-6 space-y-3">
        {visible.length === 0 && <p className="text-sm text-zinc-400">No open jobs match these filters yet.</p>}
        {visible.map((j) => {
          const org = orgById.get(j.orgId)!;
          const pay = payBand(j.payMin, j.payMax, j.currency);
          return (
            <Card key={j.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/careers/jobs/${j.id}`} className="text-base font-semibold text-white hover:underline">
                    {j.title}
                  </Link>
                  <p className="text-sm text-zinc-400">
                    {org.name} · {j.city}
                    {j.sport ? ` · ${j.sport}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Pill tone="lime">{isJobRole(j.role) ? JOB_ROLE_LABELS[j.role] : j.role}</Pill>
                  <Pill>{isEmploymentType(j.employmentType) ? EMPLOYMENT_TYPE_LABELS[j.employmentType] : j.employmentType}</Pill>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {pay ? `${pay} · ` : ""}Posted {istDate(j.createdAt)}
              </p>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
