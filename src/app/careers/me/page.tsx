import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { APPLICATION_STATUS_LABELS, allowedApplicationMoves, isApplicationStatus } from "@/lib/careers";
import { credentialLabel } from "@/lib/credentials";
import {
  addCredential,
  addExperience,
  removeCredential,
  removeExperience,
  saveProfessionalProfile,
  withdrawApplication,
} from "@/app/actions/careers";
import { Card, Field, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls, ist } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My professional profile | Triq Careers", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

const statusTone = (s: string) => (s === "VERIFIED" ? "emerald" : s === "REVIEWED" ? "sky" : s === "REJECTED" ? "rose" : "amber") as
  | "emerald"
  | "sky"
  | "rose"
  | "amber";

export default async function CareersMePage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.careers) notFound();
  const session = await requireAuth();
  const sp = await searchParams;
  const userId = session.id as string;

  const [profile, experience, credentials, applications] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId } }),
    db.professionalExperience.findMany({ where: { userId }, orderBy: [{ startYear: "desc" }] }),
    db.professionalCredential.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.jobApplication.findMany({ where: { applicantId: userId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const jobs = applications.length
    ? await db.jobListing.findMany({ where: { id: { in: applications.map((a) => a.jobId) } }, select: { id: true, title: true, orgId: true } })
    : [];
  const orgs = jobs.length
    ? await db.organization.findMany({ where: { id: { in: jobs.map((j) => j.orgId) } }, select: { id: true, name: true } })
    : [];
  const events = applications.length
    ? await db.jobApplicationEvent.findMany({ where: { applicationId: { in: applications.map((a) => a.id) } }, orderBy: { createdAt: "asc" } })
    : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const orgById = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <Page
      eyebrow="Triq Careers"
      title="My professional profile"
      actions={
        <Link href="/careers" className={ghostButtonCls}>
          Browse jobs
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />

      <Section title="Profile">
        <form action={saveProfessionalProfile} className="grid gap-3 sm:grid-cols-2">
          <Field label="Headline">
            <input name="headline" maxLength={120} defaultValue={profile?.headline ?? ""} placeholder="e.g. Level 2 football coach, U-12 specialist" className={inputCls} />
          </Field>
          <Field label="City">
            <input name="city" maxLength={80} defaultValue={profile?.city ?? ""} className={inputCls} />
          </Field>
          <Field label="Sports (comma separated)">
            <input name="sports" defaultValue={profile?.sports.join(", ") ?? ""} className={inputCls} />
          </Field>
          <Field label="Years of experience">
            <input name="yearsExperience" inputMode="numeric" defaultValue={profile?.yearsExperience ?? ""} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="About you">
              <textarea name="bio" rows={4} maxLength={2000} defaultValue={profile?.bio ?? ""} className={inputCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
            <input type="checkbox" name="isPublic" defaultChecked={profile?.isPublic ?? false} />
            Let organisations I have not applied to see my profile (off by default)
          </label>
          <div>
            <button className={buttonCls}>Save profile</button>
          </div>
        </form>
      </Section>

      <Section title="Experience">
        <div className="space-y-2">
          {experience.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">
                    {e.title} · {e.organization}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {e.startYear} – {e.endYear ?? "present"}
                  </p>
                  {e.description && <p className="mt-1 text-sm text-zinc-300">{e.description}</p>}
                </div>
                <form action={removeExperience}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-xs text-zinc-500 hover:text-rose-300">Remove</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
        <form action={addExperience} className="mt-3 grid gap-2 sm:grid-cols-4">
          <input name="title" required placeholder="Role" className={inputCls} />
          <input name="organization" required placeholder="Organisation" className={inputCls} />
          <input name="startYear" required inputMode="numeric" placeholder="From (year)" className={inputCls} />
          <input name="endYear" inputMode="numeric" placeholder="To (blank = now)" className={inputCls} />
          <input name="description" placeholder="What you did (optional)" className={`${inputCls} sm:col-span-3`} />
          <button className={ghostButtonCls}>Add role</button>
        </form>
      </Section>

      <Section title="Qualifications & certifications">
        <p className="text-xs text-zinc-500">
          New entries are marked “Submitted”. Only Triq&apos;s verification team can mark a credential reviewed or verified.
        </p>
        <div className="mt-2 space-y-2">
          {credentials.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">
                    {c.title}
                    {c.issuer ? ` · ${c.issuer}` : ""}
                    {c.issuedYear ? ` (${c.issuedYear})` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Pill tone={statusTone(c.status)}>{credentialLabel(c.status)}</Pill>
                    <span className="text-xs text-zinc-500">{c.kind === "QUALIFICATION" ? "Qualification" : "Certification"}</span>
                    {c.evidenceUrl && (
                      <a href={c.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-lime-300 hover:underline">
                        Evidence
                      </a>
                    )}
                  </div>
                  {c.status === "REJECTED" && c.rejectReason && <p className="mt-1 text-xs text-rose-300">{c.rejectReason}</p>}
                </div>
                <form action={removeCredential}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-zinc-500 hover:text-rose-300">Remove</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
        <form action={addCredential} className="mt-3 grid gap-2 sm:grid-cols-3">
          <select name="kind" className={inputCls} defaultValue="CERTIFICATION">
            <option value="CERTIFICATION">Certification</option>
            <option value="QUALIFICATION">Qualification</option>
          </select>
          <input name="title" required placeholder="e.g. AIFF D-licence" className={inputCls} />
          <input name="issuer" placeholder="Issued by" className={inputCls} />
          <input name="issuedYear" inputMode="numeric" placeholder="Year" className={inputCls} />
          <input name="evidenceUrl" placeholder="Link to certificate (https://…)" className={inputCls} />
          <button className={ghostButtonCls}>Submit credential</button>
        </form>
      </Section>

      <Section title="My applications">
        {applications.length === 0 && <p className="text-sm text-zinc-400">You have not applied to any jobs yet.</p>}
        <div className="space-y-2">
          {applications.map((a) => {
            const job = jobById.get(a.jobId);
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/careers/jobs/${a.jobId}`} className="font-medium text-white hover:underline">
                      {job?.title ?? "Job"}
                    </Link>
                    <p className="text-xs text-zinc-400">{job ? orgById.get(job.orgId) : ""}</p>
                  </div>
                  <Pill tone="lime">{isApplicationStatus(a.status) ? APPLICATION_STATUS_LABELS[a.status] : a.status}</Pill>
                </div>
                <ol className="mt-2 space-y-0.5 text-xs text-zinc-500">
                  {events
                    .filter((e) => e.applicationId === a.id)
                    .map((e) => (
                      <li key={e.id}>
                        {ist(e.createdAt)} — {isApplicationStatus(e.toStatus) ? APPLICATION_STATUS_LABELS[e.toStatus] : e.toStatus}
                      </li>
                    ))}
                </ol>
                {allowedApplicationMoves(a.status, "APPLICANT").length > 0 && (
                  <form action={withdrawApplication} className="mt-2">
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-xs text-zinc-400 hover:text-rose-300">Withdraw</button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      </Section>
    </Page>
  );
}
