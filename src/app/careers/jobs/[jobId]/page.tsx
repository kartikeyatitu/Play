import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import {
  APPLICATION_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  JOB_ROLE_LABELS,
  allowedApplicationMoves,
  isApplicationStatus,
  isEmploymentType,
  isJobRole,
  payBand,
} from "@/lib/careers";
import { applyToJob, withdrawApplication } from "@/app/actions/careers";
import { Card, Flash, Page, Pill, Section, buttonCls, ghostButtonCls, inputCls, ist, istDate } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";

type Params = Promise<{ jobId: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

async function loadJob(jobId: string) {
  if (!jobId || jobId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(jobId)) return null;
  // Only OPEN or CLOSED jobs are public; drafts stay private to the employer.
  const job = await db.jobListing.findFirst({ where: { id: jobId, status: { in: ["OPEN", "CLOSED"] } } });
  if (!job) return null;
  const org = await db.organization.findFirst({ where: { id: job.orgId, isActive: true }, select: { name: true, slug: true, city: true } });
  if (!org) return null;
  return { job, org };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!FEATURES.careers) return { title: "Not found | Triq" };
  const { jobId } = await params;
  const data = await loadJob(jobId);
  if (!data) return { title: "Job not found | Triq" };
  return { title: `${data.job.title} · ${data.org.name} | Triq Careers`, description: data.job.description.slice(0, 160) };
}

export default async function JobPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  if (!FEATURES.careers) notFound();
  const { jobId } = await params;
  const sp = await searchParams;
  const data = await loadJob(jobId);
  if (!data) notFound();
  const { job, org } = data;
  const session = await getSession();

  const application = session
    ? await db.jobApplication.findUnique({ where: { jobId_applicantId: { jobId: job.id, applicantId: String(session.id) } } })
    : null;
  const history = application
    ? await db.jobApplicationEvent.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "asc" } })
    : [];
  const pay = payBand(job.payMin, job.payMax, job.currency);

  return (
    <Page
      eyebrow={org.name}
      title={job.title}
      actions={
        <Link href="/careers" className={ghostButtonCls}>
          All jobs
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />
      <div className="mt-4 flex flex-wrap gap-1">
        <Pill tone="lime">{isJobRole(job.role) ? JOB_ROLE_LABELS[job.role] : job.role}</Pill>
        <Pill>{isEmploymentType(job.employmentType) ? EMPLOYMENT_TYPE_LABELS[job.employmentType] : job.employmentType}</Pill>
        {job.status === "CLOSED" && <Pill tone="rose">Closed</Pill>}
      </div>
      <p className="mt-3 text-sm text-zinc-400">
        <Link href={`/academy/${org.slug}`} className="hover:underline">
          {org.name}
        </Link>{" "}
        · {job.city}
        {job.sport ? ` · ${job.sport}` : ""}
        {pay ? ` · ${pay}` : ""} · Posted {istDate(job.createdAt)}
      </p>

      <Section title="About the role">
        <p className="whitespace-pre-line text-sm leading-6 text-zinc-200">{job.description}</p>
      </Section>
      {job.requirements && (
        <Section title="Requirements">
          <p className="whitespace-pre-line text-sm leading-6 text-zinc-200">{job.requirements}</p>
        </Section>
      )}

      <Section title="Apply">
        {application ? (
          <Card>
            <p className="text-sm">
              Your application:{" "}
              <strong>{isApplicationStatus(application.status) ? APPLICATION_STATUS_LABELS[application.status] : application.status}</strong>
            </p>
            <ol className="mt-2 space-y-1 text-xs text-zinc-400">
              {history.map((h) => (
                <li key={h.id}>
                  {ist(h.createdAt)} — {isApplicationStatus(h.toStatus) ? APPLICATION_STATUS_LABELS[h.toStatus] : h.toStatus}
                </li>
              ))}
            </ol>
            {allowedApplicationMoves(application.status, "APPLICANT").length > 0 && (
              <form action={withdrawApplication} className="mt-3">
                <input type="hidden" name="id" value={application.id} />
                <button className={ghostButtonCls}>Withdraw application</button>
              </form>
            )}
          </Card>
        ) : job.status !== "OPEN" ? (
          <p className="text-sm text-zinc-400">This job is no longer accepting applications.</p>
        ) : !session ? (
          <p className="text-sm text-zinc-300">
            <Link href="/login" className="text-lime-300 hover:underline">
              Sign in
            </Link>{" "}
            to apply.
          </p>
        ) : (
          <form action={applyToJob} className="space-y-3">
            <input type="hidden" name="jobId" value={job.id} />
            <textarea name="coverNote" rows={5} maxLength={2000} placeholder="Why are you a good fit? (optional)" className={inputCls} />
            <p className="text-xs text-zinc-500">
              When you apply, {org.name} sees your name, phone or email, your Triq professional profile and this note.
            </p>
            <button className={buttonCls}>Apply</button>
          </form>
        )}
      </Section>
    </Page>
  );
}
