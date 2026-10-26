import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import {
  APPLICATION_STATUS_LABELS,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_ROLES,
  JOB_ROLE_LABELS,
  allowedApplicationMoves,
  canTransitionJob,
  isApplicationStatus,
  isJobRole,
} from "@/lib/careers";
import { credentialLabel } from "@/lib/credentials";
import { createJob, setJobStatus, updateApplicationStatus } from "@/app/actions/careers";
import { Card, Field, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls, ist, istDate } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs & applicants | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function OrgCareersPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.careers) notFound();
  const sp = await searchParams;
  const auth = await checkPermission("careers.manage");
  if (!auth.ok) {
    return (
      <Page eyebrow="Careers" title="Jobs & applicants">
        <Flash error={auth.error} />
      </Page>
    );
  }
  const orgId = auth.session.orgId;
  const selectedJobId = one(sp.job);

  const jobs = await db.jobListing.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 100 });
  const counts = await db.jobApplication.groupBy({ by: ["jobId"], where: { orgId }, _count: { _all: true } });
  const countByJob = new Map(counts.map((c) => [c.jobId, c._count._all]));
  const selected = jobs.find((j) => j.id === selectedJobId) ?? null;

  // Applicants are loaded only for a job of this org (tenant scoped by orgId + jobId).
  const applications = selected
    ? await db.jobApplication.findMany({ where: { orgId, jobId: selected.id }, orderBy: { createdAt: "asc" } })
    : [];
  const applicantIds = applications.map((a) => a.applicantId);
  const [users, profiles, credentials, events] = applicantIds.length
    ? await Promise.all([
        db.user.findMany({ where: { id: { in: applicantIds } }, select: { id: true, name: true, email: true, phone: true } }),
        db.professionalProfile.findMany({ where: { userId: { in: applicantIds } } }),
        db.professionalCredential.findMany({ where: { userId: { in: applicantIds } }, orderBy: { createdAt: "desc" } }),
        db.jobApplicationEvent.findMany({ where: { orgId, applicationId: { in: applications.map((a) => a.id) } }, orderBy: { createdAt: "asc" } }),
      ])
    : [[], [], [], []];
  const userById = new Map(users.map((u) => [u.id, u]));
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

  return (
    <Page
      eyebrow="Careers"
      title="Jobs & applicants"
      actions={
        <Link href="/org" className={ghostButtonCls}>
          Back to dashboard
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />

      <Section title="Your jobs">
        {jobs.length === 0 && <p className="text-sm text-zinc-400">No jobs yet. Post your first one below.</p>}
        <div className="space-y-2">
          {jobs.map((j) => (
            <Card key={j.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/org/careers?job=${j.id}#applicants`} className="font-medium text-white hover:underline">
                    {j.title}
                  </Link>
                  <p className="text-xs text-zinc-400">
                    {isJobRole(j.role) ? JOB_ROLE_LABELS[j.role] : j.role} · {j.city} · {countByJob.get(j.id) ?? 0} applicant(s) · created{" "}
                    {istDate(j.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={j.status === "OPEN" ? "emerald" : j.status === "DRAFT" ? "amber" : "zinc"}>{j.status}</Pill>
                  {(["OPEN", "CLOSED"] as const)
                    .filter((to) => canTransitionJob(j.status, to))
                    .map((to) => (
                      <form key={to} action={setJobStatus}>
                        <input type="hidden" name="id" value={j.id} />
                        <input type="hidden" name="status" value={to} />
                        <button className={ghostButtonCls}>{to === "OPEN" ? (j.status === "DRAFT" ? "Publish" : "Reopen") : "Close"}</button>
                      </form>
                    ))}
                  {j.status !== "DRAFT" && (
                    <Link href={`/careers/jobs/${j.id}`} className="text-xs text-lime-300 hover:underline">
                      Public page
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {selected && (
        <Section title={`Applicants — ${selected.title}`} id="applicants">
          {applications.length === 0 && <p className="text-sm text-zinc-400">No applications yet.</p>}
          <div className="space-y-3">
            {applications.map((a) => {
              const u = userById.get(a.applicantId);
              const p = profileByUser.get(a.applicantId);
              const creds = credentials.filter((c) => c.userId === a.applicantId);
              const moves = allowedApplicationMoves(a.status, "EMPLOYER");
              return (
                <Card key={a.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{u?.name ?? "Applicant"}</p>
                      <p className="text-xs text-zinc-400">{[u?.phone, u?.email].filter(Boolean).join(" · ")}</p>
                      {p?.headline && <p className="mt-1 text-sm text-zinc-300">{p.headline}</p>}
                      {p && (
                        <p className="text-xs text-zinc-500">
                          {[p.city, p.sports.join(", "), p.yearsExperience != null ? `${p.yearsExperience} yrs` : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <Pill tone="lime">{isApplicationStatus(a.status) ? APPLICATION_STATUS_LABELS[a.status] : a.status}</Pill>
                  </div>
                  {creds.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-zinc-400">
                      {creds.map((c) => (
                        <li key={c.id}>
                          {c.title}
                          {c.issuer ? ` (${c.issuer})` : ""} — {credentialLabel(c.status)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.coverNote && <p className="mt-2 whitespace-pre-line rounded-lg bg-white/[0.03] p-2 text-sm text-zinc-200">{a.coverNote}</p>}
                  <ol className="mt-2 space-y-0.5 text-xs text-zinc-500">
                    {events
                      .filter((e) => e.applicationId === a.id)
                      .map((e) => (
                        <li key={e.id}>
                          {ist(e.createdAt)} — {isApplicationStatus(e.toStatus) ? APPLICATION_STATUS_LABELS[e.toStatus] : e.toStatus}
                          {e.note ? ` · “${e.note}”` : ""}
                        </li>
                      ))}
                  </ol>
                  {moves.length > 0 && (
                    <form action={updateApplicationStatus} className="mt-3 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <select name="status" className={`${inputCls} w-auto`}>
                        {moves.map((m) => (
                          <option key={m} value={m}>
                            {APPLICATION_STATUS_LABELS[m]}
                          </option>
                        ))}
                      </select>
                      <input name="note" maxLength={500} placeholder="Internal note (optional)" className={`${inputCls} flex-1`} />
                      <button className={buttonCls}>Update</button>
                    </form>
                  )}
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Post a job">
        <form action={createJob} className="grid gap-3 sm:grid-cols-2">
          <Field label="Job title">
            <input name="title" required maxLength={120} className={inputCls} />
          </Field>
          <Field label="Role">
            <select name="role" className={inputCls} defaultValue="COACH">
              {JOB_ROLES.map((r) => (
                <option key={r} value={r}>
                  {JOB_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employment type">
            <select name="employmentType" className={inputCls} defaultValue="FULL_TIME">
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sport">
            <input name="sport" maxLength={40} className={inputCls} />
          </Field>
          <Field label="City">
            <input name="city" required maxLength={80} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pay from (per month)">
              <input name="payMin" inputMode="numeric" className={inputCls} />
            </Field>
            <Field label="Pay up to (per month)">
              <input name="payMax" inputMode="numeric" className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea name="description" required rows={5} minLength={20} maxLength={5000} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Requirements (optional)">
              <textarea name="requirements" rows={3} maxLength={3000} className={inputCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="publish" value="1" /> Publish now (otherwise saved as draft)
          </label>
          <div>
            <button className={buttonCls}>Save job</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-zinc-500">Pay is optional and shown to applicants as entered, in your academy&apos;s currency.</p>
      </Section>
    </Page>
  );
}
