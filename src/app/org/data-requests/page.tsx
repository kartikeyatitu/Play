import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { isOrgOwner } from "@/lib/membership";
import { DATA_REQUEST_STATUSES, allowedDataRequestMoves, isDataRequestStatus } from "@/lib/consent/data-requests";
import { dataRequestHistory, studentIdsForRequests } from "@/lib/consent/data-requests-server";
import { updateDataRequestStatus } from "@/app/actions/data-requests";
import { Card, Flash, Page, Pill, Section, ghostButtonCls, inputCls, ist } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Data requests | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

const TONE: Record<string, "amber" | "sky" | "emerald" | "rose"> = { REQUESTED: "amber", IN_REVIEW: "sky", DONE: "emerald", REJECTED: "rose" };
const LABEL: Record<string, string> = { REQUESTED: "Requested", IN_REVIEW: "In review", DONE: "Done", REJECTED: "Rejected" };
const MOVE_LABEL: Record<string, string> = { IN_REVIEW: "Start review", DONE: "Mark done", REJECTED: "Reject", REQUESTED: "Back to queue" };

/** Owner (own academy) and TRIQ ops (SUPER_ADMIN, all academies) review DELETE / EXPORT requests. Records decisions only. */
export default async function DataRequestsPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.dataRequests) notFound();
  const session = await requireAuth(["ADMIN", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const isOps = session.role === "SUPER_ADMIN";
  if (!isOps && !(session.orgId && (await isOrgOwner(session.id, session.orgId)))) {
    return (
      <Page eyebrow="Privacy" title="Data requests">
        <Flash error="Only the academy owner can see data requests." />
      </Page>
    );
  }

  const status = isDataRequestStatus(one(sp.status)) ? one(sp.status) : "";
  const where = { ...(isOps ? {} : { orgId: session.orgId as string }), ...(status ? { status } : {}) };
  const requests = await db.dataRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  const refs = requests.map((r) => r.referenceId);
  const [studentMap, history] = await Promise.all([studentIdsForRequests(refs), dataRequestHistory(refs)]);
  const userIds = Array.from(new Set(requests.map((r) => r.userId).filter((u): u is string => !!u)));
  const studentIds = Array.from(new Set(studentMap.values()));
  const [users, students, orgs] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    studentIds.length ? db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    isOps ? db.organization.findMany({ where: { id: { in: requests.map((r) => r.orgId).filter((o): o is string => !!o) } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const studentName = new Map(students.map((s) => [s.id, s.name]));
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <Page
      eyebrow="Privacy"
      title="Data requests"
      actions={
        <Link href={isOps ? "/ops/leads" : "/org"} className={ghostButtonCls}>
          Back
        </Link>
      }
    >
      <Flash error={sp.error} saved={sp.saved} />
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        This queue records decisions. It does not delete or send anything by itself. Mark a deletion done only after it has been carried out through the
        approved manual process; financial records are kept. An approved export becomes downloadable by the requesting parent for 7 days.
      </p>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 text-sm">
        {["", ...DATA_REQUEST_STATUSES].map((s) => (
          <Link
            key={s || "all"}
            href={s ? `/org/data-requests?status=${s}` : "/org/data-requests"}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 ${s === status ? "bg-lime-400 font-semibold text-zinc-950" : "border border-white/10 text-zinc-300"}`}
          >
            {s ? LABEL[s] : "All"}
          </Link>
        ))}
      </nav>

      <Section title={`${requests.length} request${requests.length === 1 ? "" : "s"}`}>
        <div className="space-y-3">
          {requests.map((r) => {
            const sid = studentMap.get(r.referenceId);
            const moves = allowedDataRequestMoves(r.status);
            const events = history.get(r.referenceId) ?? [];
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm text-white">{r.referenceId}</p>
                  <Pill tone={TONE[r.status] ?? "zinc"}>{LABEL[r.status] ?? r.status}</Pill>
                </div>
                <p className="mt-1 text-sm text-zinc-300">
                  {r.type === "DELETE" ? "Delete account" : "Export child's data"}
                  {sid ? ` · ${studentName.get(sid) ?? "child"}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {r.userId ? userName.get(r.userId) ?? "Unknown user" : "No account"}
                  {r.phone ? ` · ••••${r.phone.slice(-4)}` : ""}
                  {isOps ? ` · ${r.orgId ? orgName.get(r.orgId) ?? "academy" : "no academy"}` : ""} · {ist(r.createdAt)}
                </p>
                {r.reason && r.type === "DELETE" ? <p className="mt-2 text-sm text-zinc-400">“{r.reason}”</p> : null}

                {events.length ? (
                  <ul className="mt-3 space-y-0.5 border-l border-white/10 pl-3 text-xs text-zinc-500">
                    {events.slice(0, 6).map((e, i) => (
                      <li key={i}>
                        {ist(e.at)} · {e.by} · {e.event === "STATUS" ? `→ ${LABEL[e.status ?? ""] ?? e.status}` : e.event.toLowerCase()}
                        {e.note ? ` · ${e.note}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {moves.length ? (
                  <form action={updateDataRequestStatus} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="note" maxLength={500} placeholder="Note (required to reject)" className={`${inputCls} min-h-11`} />
                    <div className="flex flex-wrap gap-2">
                      {moves.map((m) => (
                        <button
                          key={m}
                          name="status"
                          value={m}
                          className={`min-h-11 rounded-lg px-3 text-sm font-medium ${m === "REJECTED" ? "border border-rose-500/40 text-rose-200" : m === "DONE" ? "bg-lime-400 text-zinc-950" : "border border-white/10 text-zinc-200"}`}
                        >
                          {MOVE_LABEL[m]}
                        </button>
                      ))}
                    </div>
                  </form>
                ) : null}
              </Card>
            );
          })}
          {requests.length === 0 ? <p className="text-sm text-zinc-400">No requests.</p> : null}
        </div>
      </Section>
    </Page>
  );
}
