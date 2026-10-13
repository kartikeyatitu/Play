import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Phone, ExternalLink } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listingPath, parseSports, sportName, waLink } from "@/lib/directory";
import { updateClaimStatus, updateDirectoryLeadStatus, updateSalesLeadStatus } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops · Leads inbox | Triq",
  robots: { index: false, follow: false },
};

const SALES_STATUSES = ["NEW", "CONTACTED", "DEMO", "TRIAL", "WON", "LOST"];
const CLAIM_STATUSES = ["PENDING", "APPROVED", "REJECTED"];
const DIRECTORY_LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "SPAM"];

const STATUS_TONE: Record<string, string> = {
  NEW: "bg-lime-400/15 text-lime-300 ring-lime-400/30",
  PENDING: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  CONTACTED: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  DEMO: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  TRIAL: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  WON: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  CONVERTED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  LOST: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  REJECTED: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  SPAM: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

function ago(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function OpsLeadsPage() {
  await requireAuth(["SUPER_ADMIN"]);

  const [salesLeads, claims, dirLeads, newSales, pendingClaims, newDir] = await Promise.all([
    db.salesLead.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.claimRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { listedAcademy: { select: { name: true, slug: true, city: true, sports: true, phone: true, claimStatus: true } } },
    }),
    db.directoryLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { listedAcademy: { select: { name: true, slug: true, city: true, sports: true, phone: true } } },
    }),
    db.salesLead.count({ where: { status: "NEW" } }),
    db.claimRequest.count({ where: { status: "PENDING" } }),
    db.directoryLead.count({ where: { status: "NEW" } }),
  ]);

  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Triq ops</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Leads inbox</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <a href="#claims" className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-300 hover:text-white">
              Claims <span className="text-amber-300">{pendingClaims}</span>
            </a>
            <a href="#trials" className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-300 hover:text-white">
              Trial requests <span className="text-lime-300">{newDir}</span>
            </a>
            <a href="#sales" className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-300 hover:text-white">
              Sales leads <span className="text-lime-300">{newSales}</span>
            </a>
          </nav>
        </header>

        {/* Claims */}
        <Section id="claims" title="Listing claims" subtitle="Verify by phone, then approve. Approving marks the listing CLAIMED.">
          {claims.length === 0 && <Empty>No claims yet.</Empty>}
          {claims.map((c) => {
            const href = c.listedAcademy ? listingPath(c.listedAcademy.city, parseSports(c.listedAcademy.sports), c.listedAcademy.slug) : null;
            return (
              <Row key={c.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{c.name}</span>
                    <span className="text-xs text-zinc-500">{c.role.toLowerCase()}</span>
                    <StatusPill status={c.status} />
                    <span className="text-xs text-zinc-600">{ago(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-400">
                    {c.listedAcademy?.name ?? "—"}
                    {href && (
                      <Link href={href} target="_blank" className="ml-1.5 inline-flex items-center text-zinc-500 hover:text-white">
                        <ExternalLink className="size-3.5" />
                      </Link>
                    )}
                    {c.email && <span className="ml-2 text-zinc-500">· {c.email}</span>}
                  </p>
                  <Contact
                    phone={c.phone}
                    text={`Hi ${c.name}, this is Triq. We received your request to claim ${c.listedAcademy?.name ?? "your academy"} on Triq. Can we do a quick 2-minute call to verify?`}
                    extraPhone={c.listedAcademy?.phone}
                    extraLabel="Academy listing phone"
                  />
                </div>
                <StatusForm action={updateClaimStatus} id={c.id} status={c.status} options={CLAIM_STATUSES} />
              </Row>
            );
          })}
        </Section>

        {/* Directory trial requests */}
        <Section id="trials" title="Trial requests (directory)" subtitle="Forward to the academy, then use the request as a warm intro to sell them Triq.">
          {dirLeads.length === 0 && <Empty>No trial requests yet.</Empty>}
          {dirLeads.map((l) => {
            const href = l.listedAcademy ? listingPath(l.listedAcademy.city, parseSports(l.listedAcademy.sports), l.listedAcademy.slug) : null;
            const academy = l.listedAcademy?.name ?? "the academy";
            return (
              <Row key={l.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{l.parentName}</span>
                    {(l.childName || l.childAge) && (
                      <span className="text-xs text-zinc-500">
                        for {l.childName ?? "child"}
                        {l.childAge ? ` (${l.childAge})` : ""}
                      </span>
                    )}
                    <StatusPill status={l.status} />
                    {l.orgId && <span className="rounded bg-lime-400/10 px-1.5 py-0.5 text-[10px] font-medium text-lime-300">routed to Triq org</span>}
                    <span className="text-xs text-zinc-600">{ago(l.createdAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-400">
                    {l.sport ? `${sportName(l.sport)} · ` : ""}
                    {academy}
                    {href && (
                      <Link href={href} target="_blank" className="ml-1.5 inline-flex items-center text-zinc-500 hover:text-white">
                        <ExternalLink className="size-3.5" />
                      </Link>
                    )}
                  </p>
                  {l.message && <p className="mt-1 line-clamp-2 break-words text-xs text-zinc-500">&ldquo;{l.message}&rdquo;</p>}
                  <Contact
                    phone={l.phone}
                    text={`Hi ${l.parentName}, this is Triq. Thanks for requesting a free ${l.sport ? sportName(l.sport).toLowerCase() + " " : ""}trial at ${academy}. Which days and timings work best for you?`}
                    extraPhone={l.listedAcademy?.phone}
                    extraLabel="Call academy"
                  />
                </div>
                <StatusForm action={updateDirectoryLeadStatus} id={l.id} status={l.status} options={DIRECTORY_LEAD_STATUSES} />
              </Row>
            );
          })}
        </Section>

        {/* Sales leads */}
        <Section id="sales" title="Sales leads" subtitle="Landing page, directory claims, outbound and referrals.">
          {salesLeads.length === 0 && <Empty>No sales leads yet.</Empty>}
          {salesLeads.map((s) => (
            <Row key={s.id}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{s.name}</span>
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">{s.source}</span>
                  <StatusPill status={s.status} />
                  <span className="text-xs text-zinc-600">{ago(s.createdAt)}</span>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-400">
                  {[s.academy, s.city, s.sport ? sportName(s.sport) : null, s.students ? `${s.students} students` : null].filter(Boolean).join(" · ") || "—"}
                </p>
                {s.notes && <p className="mt-1 line-clamp-2 break-words text-xs text-zinc-500">{s.notes}</p>}
                <Contact
                  phone={s.phone}
                  text={`Hi ${s.name}, this is Triq. Thanks for your interest${s.academy ? ` in getting ${s.academy} on Triq` : ""}! When's a good time for a quick 10-minute demo?`}
                />
              </div>
              <StatusForm action={updateSalesLeadStatus} id={s.id} status={s.status} options={SALES_STATUSES} />
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
      <ul className="mt-4 divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/60">{children}</ul>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">{children}</li>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="p-6 text-center text-sm text-zinc-500">{children}</li>;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_TONE[status] ?? "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30"}`}>
      {status}
    </span>
  );
}

function Contact({ phone, text, extraPhone, extraLabel }: { phone: string; text: string; extraPhone?: string | null; extraLabel?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <a
        href={waLink(phone, text)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
      >
        <MessageCircle className="size-3.5" /> WhatsApp {phone}
      </a>
      <a href={`tel:${phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-zinc-300 hover:text-white">
        <Phone className="size-3.5" /> Call
      </a>
      {extraPhone && (
        <a href={`tel:${extraPhone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-zinc-400 hover:text-white">
          <Phone className="size-3.5" /> {extraLabel ?? "Call"}
        </a>
      )}
    </div>
  );
}

function StatusForm({
  action,
  id,
  status,
  options,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  status: string;
  options: string[];
}) {
  return (
    <form action={action} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        aria-label="Status"
        className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none focus:border-lime-400/60"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <button type="submit" className="h-9 rounded-lg bg-white px-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
        Save
      </button>
    </form>
  );
}
