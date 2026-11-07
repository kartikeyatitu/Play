"use client";
// Owner / manager rewards screen (spec §7): requests, coach-bonus review, catalogue, earn rules and caps,
// budget and audit. Works on a phone; laid out wider on a laptop.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Plus, RotateCcw } from "lucide-react";
import {
  addSuggestedRewardItems,
  reviewBonus,
  runExpiry,
  saveRewardItem,
  saveRewardsSettings,
  setRewardItemActive,
  type getRewardsOverview,
  type getRewardsSettings,
  type listPendingBonuses,
  type listRedemptions,
  type listRewardItems,
} from "@/app/actions/rewards";
import { EARN_LABELS, EARN_TRIGGERS, REWARD_KIND_LABELS, REWARD_KINDS, type EarnTrigger, type RewardKind } from "@/lib/rewards";
import { fmtDate, GhostButton, Panel, PrimaryButton, Tabs } from "./ui";
import { RedemptionsList } from "./RedemptionsList";
import { CoachAwardSheet } from "./CoachAwardSheet";

type Ok<T extends (...a: any) => any> = Extract<Awaited<ReturnType<T>>, { ok: true }>;
type Props = {
  overview: Ok<typeof getRewardsOverview>;
  settingsInfo: Ok<typeof getRewardsSettings>;
  items: Ok<typeof listRewardItems>["items"];
  pending: Ok<typeof listPendingBonuses>["pending"];
  redemptions: Ok<typeof listRedemptions>["redemptions"];
};
type Tab = "requests" | "review" | "catalogue" | "rules" | "budget";

export function OwnerRewardsWorkspace({ overview, settingsInfo, items, pending, redemptions }: Props) {
  const [tab, setTab] = useState<Tab>("requests");
  const router = useRouter();
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong");
      else {
        toast.success(msg);
        router.refresh();
      }
    });
  const openCount = redemptions.filter((r) => r.status === "REQUESTED").length;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Unspent points" value={overview.liabilityPoints} />
        <Stat label="Earned this month" value={overview.earnedThisMonth} />
        <Stat label="Open requests" value={overview.redemptions.REQUESTED ?? 0} />
        <Stat label="Expiring in 30 days" value={overview.expiringIn30Days} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <CoachAwardSheet />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "requests", label: "Requests", count: openCount || undefined },
          { key: "review", label: "Bonus review", count: pending.length || undefined },
          { key: "catalogue", label: "Catalogue" },
          { key: "rules", label: "Rules" },
          { key: "budget", label: "Budget & audit" },
        ]}
      />

      {tab === "requests" && <RedemptionsList initial={redemptions} onChange={() => router.refresh()} />}

      {tab === "review" && (
        <Panel title="Coach bonuses waiting for review">
          <p className="mb-3 text-xs text-ink-muted">A coach award of 10 points, or a coach's 3rd award in a day, waits here before it's added.</p>
          {pending.length === 0 ? <p className="text-sm text-ink-muted">Nothing to review.</p> : null}
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="py-3">
                <p className="text-sm font-semibold text-ink">
                  {p.studentName} · {p.points} pts, {p.xp} XP
                </p>
                <p className="text-sm text-ink-muted">
                  {p.reasonLabel} · by {p.coachName} · {fmtDate(p.createdAt)}
                </p>
                {p.note ? <p className="text-xs text-ink-muted">“{p.note}”</p> : null}
                <div className="mt-2 flex gap-2">
                  <PrimaryButton disabled={busy} onClick={() => act(() => reviewBonus(p.id, true), "Bonus added")}>
                    Approve
                  </PrimaryButton>
                  <GhostButton tone="danger" disabled={busy} onClick={() => act(() => reviewBonus(p.id, false), "Bonus rejected")}>
                    Reject
                  </GhostButton>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === "catalogue" && (
        <Catalogue items={items} feeCreditsEnabled={settingsInfo.settings.feeCreditsEnabled} isOwner={settingsInfo.isOwner} busy={busy} act={act} />
      )}

      {tab === "rules" && <Rules info={settingsInfo} busy={busy} act={act} />}

      {tab === "budget" && (
        <div className="space-y-4">
          <Panel title={`Budget · ${overview.month}`}>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Row k="Points liability (unspent)" v={`${overview.liabilityPoints} pts${overview.liabilityMajor != null ? ` ≈ ₹${Math.round(overview.liabilityMajor)}` : ""}`} />
              <Row k="Rewards handed over this month" v={`${overview.fulfilledThisMonth.count} · ${overview.fulfilledThisMonth.points} pts`} />
              <Row k="Cost of rewards handed over" v={overview.fulfilledThisMonth.costMajor != null ? `₹${Math.round(overview.fulfilledThisMonth.costMajor)}` : "Set a point value in Rules"} />
              <Row
                k="Share of fee revenue (target under 3%)"
                v={overview.costShareOfRevenue != null ? `${(overview.costShareOfRevenue * 100).toFixed(1)}% of ₹${Math.round(overview.feeRevenueMajor)}` : "—"}
              />
              <Row k="Fee credits approved this month" v={`${overview.feeCreditsThisMonth.count} · ₹${Math.round(overview.feeCreditsThisMonth.amountMinor / 100)}`} />
            </dl>
            {overview.feeCreditsThisMonth.count > 0 ? (
              <p className="mt-3 text-xs text-warn">Fee credits are listed in the audit log for you to apply on the fee ledger. Rewards never changes fees by itself.</p>
            ) : null}
            <div className="mt-4">
              <GhostButton disabled={busy} onClick={() => act(() => runExpiry(), "Expiry run complete")}>
                Run points expiry now
              </GhostButton>
            </div>
          </Panel>
          <Panel title="Audit log">
            <p className="mb-2 text-xs text-ink-muted">Every manual award, approval and rule change, with who did it.</p>
            <ul className="divide-y divide-line">
              {overview.audit.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <p className="text-ink">
                    <span className="font-medium">{a.action.replace(/_/g, " ").toLowerCase()}</span> · {a.by}
                  </p>
                  {a.summary ? <p className="truncate text-xs text-ink-muted">{a.summary}</p> : null}
                  <p className="text-[11px] text-ink-subtle">{fmtDate(a.at)}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{k}</dt>
      <dd className="font-semibold text-ink">{v}</dd>
    </div>
  );
}

type Act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => void;
const input = "min-h-[44px] w-full rounded-xl border border-line bg-canvas px-3 text-base text-ink sm:text-sm";

function Catalogue({ items, feeCreditsEnabled, isOwner, busy, act }: { items: Props["items"]; feeCreditsEnabled: boolean; isOwner: boolean; busy: boolean; act: Act }) {
  const empty = { id: "", name: "", description: "", costPoints: "150", stock: "", kind: "KIT" as RewardKind, minLevel: "1", minAttendance: "", weeklyCapacity: "", feeCreditRupees: "" };
  const [form, setForm] = useState(empty);
  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const kinds = REWARD_KINDS.filter((k) => k !== "FEE_CREDIT" || (feeCreditsEnabled && isOwner));

  const edit = (it: Props["items"][number]) =>
    setForm({
      id: it.id,
      name: it.name,
      description: it.description ?? "",
      costPoints: String(it.costPoints),
      stock: it.stock == null ? "" : String(it.stock),
      kind: it.eligibility.kind,
      minLevel: String(it.eligibility.minLevel ?? 1),
      minAttendance: it.eligibility.minAttendanceRate ? String(Math.round(it.eligibility.minAttendanceRate * 100)) : "",
      weeklyCapacity: it.eligibility.weeklyCapacity ? String(it.eligibility.weeklyCapacity) : "",
      feeCreditRupees: it.eligibility.feeCreditMinor ? String(it.eligibility.feeCreditMinor / 100) : "",
    });

  const save = () =>
    act(
      () =>
        saveRewardItem({
          id: form.id || undefined,
          name: form.name,
          description: form.description,
          costPoints: Number(form.costPoints),
          stock: form.stock === "" ? null : Number(form.stock),
          eligibility: {
            kind: form.kind,
            minLevel: Number(form.minLevel) || 1,
            minAttendanceRate: form.minAttendance ? Number(form.minAttendance) / 100 : undefined,
            weeklyCapacity: form.weeklyCapacity ? Number(form.weeklyCapacity) : undefined,
            feeCreditMinor: form.kind === "FEE_CREDIT" && form.feeCreditRupees ? Math.round(Number(form.feeCreditRupees) * 100) : undefined,
          },
        }).then((r) => {
          if (r.ok) setForm(empty);
          return r;
        }),
      form.id ? "Reward updated" : "Reward added",
    );

  return (
    <div className="space-y-4">
      <Panel
        title="Catalogue"
        action={
          items.length === 0 ? (
            <GhostButton disabled={busy} onClick={() => act(() => addSuggestedRewardItems(), "Starter rewards added")}>
              <Plus className="h-4 w-4" aria-hidden /> Add starter set
            </GhostButton>
          ) : null
        }
      >
        {items.length === 0 ? <p className="text-sm text-ink-muted">No rewards yet. Start with the suggested set (T-shirt, bag, coach session, showcase place) or add your own.</p> : null}
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.id} className={`flex items-start justify-between gap-3 py-3 ${it.active ? "" : "opacity-60"}`}>
              <button type="button" onClick={() => edit(it)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-ink">{it.name}</p>
                <p className="text-xs text-ink-muted">
                  {it.costPoints} pts · {it.stock == null ? "unlimited" : `${it.stock} in stock`}
                  {it.eligibility.minLevel ? ` · Level ${it.eligibility.minLevel}+` : ""}
                  {it.eligibility.minAttendanceRate ? ` · ${Math.round(it.eligibility.minAttendanceRate * 100)}%+ attendance` : ""}
                  {it.eligibility.weeklyCapacity ? ` · ${it.eligibility.weeklyCapacity}/week` : ""}
                  {it.active ? "" : " · archived"}
                </p>
              </button>
              <GhostButton disabled={busy} onClick={() => act(() => setRewardItemActive(it.id, !it.active), it.active ? "Archived" : "Restored")}>
                {it.active ? <Archive className="h-4 w-4" aria-label="Archive" /> : <RotateCcw className="h-4 w-4" aria-label="Restore" />}
              </GhostButton>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={form.id ? "Edit reward" : "Add a reward"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Type">
            <select className={input} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {REWARD_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost (points)">
            <input className={input} inputMode="numeric" value={form.costPoints} onChange={(e) => set("costPoints", e.target.value)} />
          </Field>
          <Field label="Stock (blank = unlimited)">
            <input className={input} inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
          </Field>
          <Field label="Minimum level">
            <input className={input} inputMode="numeric" value={form.minLevel} onChange={(e) => set("minLevel", e.target.value)} />
          </Field>
          <Field label="Minimum attendance % (last 90 days)">
            <input className={input} inputMode="numeric" value={form.minAttendance} onChange={(e) => set("minAttendance", e.target.value)} />
          </Field>
          <Field label="Capacity per week (blank = none)">
            <input className={input} inputMode="numeric" value={form.weeklyCapacity} onChange={(e) => set("weeklyCapacity", e.target.value)} />
          </Field>
          {form.kind === "FEE_CREDIT" ? (
            <Field label="Credit amount (₹)">
              <input className={input} inputMode="decimal" value={form.feeCreditRupees} onChange={(e) => set("feeCreditRupees", e.target.value)} />
            </Field>
          ) : null}
          <Field label="Description (optional)">
            <input className={input} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={300} />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <PrimaryButton disabled={busy || !form.name.trim()} onClick={save}>
            {form.id ? "Save changes" : "Add reward"}
          </PrimaryButton>
          {form.id ? <GhostButton onClick={() => setForm(empty)}>Cancel</GhostButton> : null}
        </div>
        <p className="mt-3 text-xs text-ink-subtle">Stock is taken when a request is approved, not when it's made. Eligibility is checked again when a parent requests.</p>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Rules({ info, busy, act }: { info: Props["settingsInfo"]; busy: boolean; act: Act }) {
  const s = info.settings;
  const [rules, setRules] = useState(() => Object.fromEntries(EARN_TRIGGERS.map((t) => [t, { xp: String(s.earnRules[t].xp), points: String(s.earnRules[t].points) }])) as Record<EarnTrigger, { xp: string; points: string }>);
  const [tiers, setTiers] = useState(s.tierNames.join(", "));
  const [pointValue, setPointValue] = useState(s.pointValueMinor ? String(s.pointValueMinor / 100) : "");
  const [feeCredits, setFeeCredits] = useState(s.feeCreditsEnabled);

  const save = () =>
    act(
      () =>
        saveRewardsSettings({
          earnRules: Object.fromEntries(EARN_TRIGGERS.map((t) => [t, { xp: Number(rules[t].xp), points: Number(rules[t].points) }])) as any,
          tierNames: tiers.split(",").map((x) => x.trim()).filter(Boolean),
          pointValueMinor: pointValue ? Math.round(Number(pointValue) * 100) : 0,
          feeCreditsEnabled: feeCredits,
        }),
      "Rules saved",
    );

  return (
    <div className="space-y-4">
      <Panel title="Earn rules">
        <p className="mb-3 text-xs text-ink-muted">Set each value between 0 and its limit. Missed sessions, injury and illness never take anything away.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-subtle">
                <th className="py-2 pr-2 font-medium">Trigger</th>
                <th className="py-2 pr-2 font-medium">XP</th>
                <th className="py-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {EARN_TRIGGERS.map((t) => (
                <tr key={t}>
                  <td className="py-2 pr-2 text-ink">
                    {EARN_LABELS[t]}
                    {t === "COACH_BONUS" ? <span className="block text-[11px] text-ink-subtle">maximum per award</span> : null}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`${EARN_LABELS[t]} XP (max ${info.ceilings[t].xp})`}
                      className="min-h-[44px] w-16 rounded-lg border border-line bg-canvas px-2 tabular-nums text-ink"
                      inputMode="numeric"
                      value={rules[t].xp}
                      onChange={(e) => setRules((r) => ({ ...r, [t]: { ...r[t], xp: e.target.value } }))}
                    />
                    <span className="ml-1 text-[11px] text-ink-subtle">/{info.ceilings[t].xp}</span>
                  </td>
                  <td className="py-2">
                    <input
                      aria-label={`${EARN_LABELS[t]} points (max ${info.ceilings[t].points})`}
                      className="min-h-[44px] w-16 rounded-lg border border-line bg-canvas px-2 tabular-nums text-ink"
                      inputMode="numeric"
                      value={rules[t].points}
                      onChange={(e) => setRules((r) => ({ ...r, [t]: { ...r[t], points: e.target.value } }))}
                    />
                    <span className="ml-1 text-[11px] text-ink-subtle">/{info.ceilings[t].points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Fixed limits">
        <ul className="space-y-1 text-sm text-ink-muted">
          <li>Attendance points: at most {info.caps.attendancePointsPerMonth} per child per month.</li>
          <li>All points: at most {info.caps.pointsPerMonth} per child per month.</li>
          <li>Coach bonus: up to {info.caps.coachBonusPointsPerAward} points per award, {info.caps.coachBonusPointsPerWeek} per coach per child per week.</li>
          <li>Owner review: an award of {info.caps.reviewAtPoints} points, or a coach's {info.caps.reviewAtAwardsPerDay}rd award in a day.</li>
          <li>Points expire 12 months after they're earned. XP never expires.</li>
        </ul>
      </Panel>

      <Panel title="Level names">
        <p className="mb-2 text-xs text-ink-muted">Names only; XP thresholds are the same across TRIQ. Separate from the passport's skill levels.</p>
        <input className={input} value={tiers} onChange={(e) => setTiers(e.target.value)} />
      </Panel>

      <Panel title="Budget and fee credits">
        <Field label="What one point costs you (₹, for the budget view)">
          <input className={input} inputMode="decimal" value={pointValue} onChange={(e) => setPointValue(e.target.value)} />
        </Field>
        <label className={`mt-3 flex min-h-[44px] items-start gap-3 ${info.isOwner ? "cursor-pointer" : "opacity-60"}`}>
          <input type="checkbox" className="mt-1 h-5 w-5" checked={feeCredits} disabled={!info.isOwner} onChange={(e) => setFeeCredits(e.target.checked)} />
          <span className="text-sm text-ink">
            Allow fee-credit rewards
            <span className="block text-xs text-ink-muted">
              Owner only. Each fee credit needs your approval and is listed for you to apply on the fee ledger yourself. Get tax advice before turning this on.
            </span>
          </span>
        </label>
      </Panel>

      <PrimaryButton disabled={busy} onClick={save}>
        Save rules
      </PrimaryButton>
    </div>
  );
}
