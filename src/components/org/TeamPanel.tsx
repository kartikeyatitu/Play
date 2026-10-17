"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Phone, Plus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addTeamMember, getTeam, markStaffAttendance, removeTeamMember, updateTeamMember } from "@/app/actions/team";
import { unwrap } from "@/lib/action-result";
import { haptic, stagger } from "@/lib/motion";
import { CountUp } from "@/components/ui/count-up";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { SportMotif } from "@/components/sport/SportMotif";
import { track } from "@/lib/analytics";
import {
  ATTENDANCE_LABELS,
  STAFF_ATTENDANCE_STATUSES,
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  roleLabel,
  type StaffAttendanceStatus,
} from "@/lib/team";

type Team = Extract<Awaited<ReturnType<typeof getTeam>>, { ok: true }>;
type Member = Team["members"][number];

const fieldCls = "w-full h-11 rounded-lg bg-surface border border-line px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt/60";
const labelCls = "text-xs font-semibold text-ink-muted uppercase tracking-wide";

const ROLE_TONE: Record<string, string> = {
  OWNER: "bg-volt/10 text-volt-ink border-volt/30",
  MANAGER: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  COACH: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  STAFF: "bg-zinc-800 text-zinc-300 border-zinc-700",
};

const ATT_TONE: Record<StaffAttendanceStatus, string> = {
  PRESENT: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  HALF_DAY: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  LEAVE: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  ABSENT: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};
const ATT_SHORT: Record<StaffAttendanceStatus, string> = { PRESENT: "In", HALF_DAY: "Half", LEAVE: "Leave", ABSENT: "Absent" };

const formatTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "";

const formatPay = (m: Member) => {
  if (!m.payType || m.payAmount == null) return null;
  const amount = `₹${m.payAmount.toLocaleString("en-IN")}`;
  return m.payType === "PER_SESSION" ? `${amount} / session` : `${amount} / month`;
};

export function TeamPanel() {
  const [team, setTeam] = React.useState<Team | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  // The chip the owner just tapped pops once (not every chip on every render)
  const [justMarked, setJustMarked] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setTeam(unwrap(await getTeam()));
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Couldn't load your team");
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const can = (p: string) => !!team?.viewer.permissions.includes(p as never);

  async function mark(member: Member, status: StaffAttendanceStatus) {
    setBusyId(member.id);
    setJustMarked(`${member.id}:${status}`);
    if (status === "PRESENT") haptic(12);
    // Optimistic: show the change at once, roll back if the server says no
    const prev = team;
    setTeam((t) =>
      t && {
        ...t,
        members: t.members.map((m) => (m.id === member.id ? { ...m, todayAttendance: { status, checkInAt: m.todayAttendance?.checkInAt ?? null, checkOutAt: m.todayAttendance?.checkOutAt ?? null } } : m)),
      }
    );
    try {
      unwrap(await markStaffAttendance(member.id, status));
    } catch (e: any) {
      setTeam(prev);
      toast.error(e?.message || "Couldn't save attendance");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: Member) {
    setMenuFor(null);
    if (!confirm(`Remove ${member.name} from your team? Their login and history stay, but they lose access to this academy.`)) return;
    setBusyId(member.id);
    try {
      const res = unwrap(await removeTeamMember(member.id));
      toast.success(`${member.name} removed from the team`);
      if (res.assignedBatches) toast.warning(`${res.assignedBatches} batch${res.assignedBatches > 1 ? "es still list" : " still lists"} ${member.name} as coach. Assign a new coach in Batches.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't remove");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</div>;
  if (!team) {
    return (
      <PanelSkeleton label="Loading your team…" />
    );
  }

  const active = team.members;
  const markedToday = active.filter((m) => m.todayAttendance);
  const inToday = active.filter((m) => m.todayAttendance?.status === "PRESENT" || m.todayAttendance?.status === "HALF_DAY");
  const counts = {
    coaches: active.filter((m) => m.role === "COACH").length,
    staff: active.filter((m) => m.role === "STAFF").length,
    managers: active.filter((m) => m.role === "MANAGER" || m.role === "OWNER").length,
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-ink tracking-tight">Your team</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {counts.coaches} coach{counts.coaches === 1 ? "" : "es"} · {counts.staff} staff · {counts.managers} owner/manager{counts.managers === 1 ? "" : "s"}
          </p>
        </div>
        {can("team.manage") && (
          <Button onClick={() => setAdding(true)} className="press bg-volt text-volt-fg hover:bg-volt-ink font-bold h-11">
            <Plus className="w-4 h-4 mr-1.5" /> Add team member
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryTile i={0} label="Checked in today" value={<><CountUp value={inToday.length} />/{active.length}</>} accent={inToday.length === active.length && active.length > 0} />
        <SummaryTile i={1} label="Not marked yet" value={<CountUp value={active.length - markedToday.length} />} />
        <SummaryTile i={2} label="On leave" value={<CountUp value={active.filter((m) => m.todayAttendance?.status === "LEAVE").length} />} />
      </div>

      {/* Members */}
      {active.length <= 1 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <SportMotif sport="multi" loops={1} className="w-28 h-auto mx-auto" />
          <p className="mt-3 font-semibold text-zinc-200">It's just you so far</p>
          <p className="text-sm text-ink-subtle mt-1">Add your coaches, receptionist, accountant and ground staff. Everyone logs in with their phone number.</p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {active.map((m, i) => {
          const att = m.todayAttendance;
          const pay = formatPay(m);
          const st = stagger(i, 3);
          return (
            <li key={m.id} style={st.style} className={`${st.className} rounded-xl border border-line/70 bg-surface/40 p-3 sm:p-4`}>
              <div className="flex items-start gap-3">
                <div className={`relative w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-heading text-lg font-bold text-zinc-200 shrink-0 ring-2 ring-offset-2 ring-offset-canvas ${att?.status === "PRESENT" || att?.status === "HALF_DAY" ? "ring-success/70" : "ring-transparent"}`}>
                  {m.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink truncate">{m.name}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ROLE_TONE[m.role] || ROLE_TONE.STAFF}`}>
                      {roleLabel(m.role, m.staffRole)}
                    </span>
                    {m.title && <span className="text-xs text-ink-muted">{m.title}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-zinc-300">
                        <Phone className="w-3 h-3" /> {m.phone}
                      </a>
                    )}
                    {m.role === "COACH" && <span>{m.batches.length ? `${m.batches.length} batch${m.batches.length > 1 ? "es" : ""}` : "No batches yet"}</span>}
                    {pay && <span className="text-ink-muted">{pay}</span>}
                    {att?.checkInAt && (
                      <span className="text-emerald-400/90">
                        In {formatTime(att.checkInAt)}
                        {att.checkOutAt ? ` · Out ${formatTime(att.checkOutAt)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                {can("team.manage") && m.role !== "OWNER" && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`More options for ${m.name}`}
                      onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-zinc-800"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuFor === m.id && (
                      <div className="absolute right-0 top-10 z-20 w-44 rounded-lg border border-line bg-canvas shadow-xl py-1">
                        <button type="button" className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800" onClick={() => { setMenuFor(null); setEditing(m); }}>
                          Edit role and pay
                        </button>
                        <button type="button" className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={() => remove(m)}>
                          <UserMinus className="w-3.5 h-3.5" /> Remove from team
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Today's attendance */}
              {can("team.manage") && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={`Today's attendance for ${m.name}`}>
                  <span className="text-[11px] uppercase tracking-wider text-ink-subtle mr-1">Today</span>
                  {STAFF_ATTENDANCE_STATUSES.map((s) => {
                    const on = att?.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={busyId === m.id}
                        onClick={() => !on && mark(m, s)}
                        className={`press h-8 px-3 rounded-full border text-xs font-semibold ${
                          on ? ATT_TONE[s] : "border-line text-ink-muted hover:text-ink hover:border-zinc-600"
                        } ${on && justMarked === `${m.id}:${s}` ? "pop-in" : ""}`}
                        title={ATTENDANCE_LABELS[s]}
                      >
                        {ATT_SHORT[s]}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <MemberDialog
        open={adding}
        onOpenChange={setAdding}
        canSetPay={can("payroll.manage")}
        canMakeManager={team.viewer.role === "OWNER"}
        onSaved={async (msg) => {
          toast.success(msg);
          setAdding(false);
          await load();
        }}
      />
      <MemberDialog
        open={!!editing}
        member={editing}
        onOpenChange={(v) => !v && setEditing(null)}
        canSetPay={can("payroll.manage")}
        canMakeManager={team.viewer.role === "OWNER"}
        onSaved={async (msg) => {
          toast.success(msg);
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

function SummaryTile({ label, value, accent, i = 0 }: { label: string; value: React.ReactNode; accent?: boolean; i?: number }) {
  const st = stagger(i, 1);
  return (
    <div style={st.style} className={`${st.className} relative overflow-hidden rounded-xl border p-3 ${accent ? "border-volt/40 bg-volt/5" : "border-line/70 bg-surface/40"}`}>
      <span className="texture-court pointer-events-none absolute inset-0" aria-hidden />
      <div className={`relative font-heading text-[28px] leading-none font-bold tabular-nums ${accent ? "text-volt-ink num-glow" : "text-ink"}`}>{value}</div>
      <div className="relative text-[11px] font-medium text-ink-subtle mt-1.5 leading-tight">{label}</div>
    </div>
  );
}

function MemberDialog({
  open,
  onOpenChange,
  member,
  canSetPay,
  canMakeManager,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member?: Member | null;
  canSetPay: boolean;
  canMakeManager: boolean;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const editing = !!member;
  const [role, setRole] = React.useState("COACH");
  const [staffRole, setStaffRole] = React.useState("RECEPTIONIST");
  const [payType, setPayType] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setRole(member?.role && member.role !== "OWNER" ? member.role : "COACH");
    setStaffRole(member?.staffRole || "RECEPTIONIST");
    setPayType(member?.payType || "");
  }, [open, member]);

  async function submit(form: FormData) {
    setSaving(true);
    try {
      const base = {
        role,
        staffRole: role === "STAFF" ? staffRole : null,
        title: String(form.get("title") || ""),
        ...(canSetPay ? { payType: payType || null, payAmount: payType ? String(form.get("payAmount") || "") : null } : {}),
      };
      if (editing && member) {
        unwrap(await updateTeamMember(member.id, base));
        await onSaved(`${member.name}'s details updated`);
      } else {
        const name = String(form.get("name") || "");
        const res = unwrap(await addTeamMember({ ...base, name, phone: String(form.get("phone") || "") }));
        track("team_member_added", { role: String(base.role), staff_role: base.staffRole ? String(base.staffRole) : null, joined_other_academy: Boolean(res.joinedOtherAcademy) });
        await onSaved(res.joinedOtherAcademy ? `${name} added. They also work at another academy and can switch between them.` : `${name} added to your team`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${member?.name}` : "Add a team member"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change their role, title or pay." : "They'll log in with this phone number. Coaches who already use Triq at another academy keep the same login."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          {!editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="tm-name">Name</label>
                <Input id="tm-name" name="name" required placeholder="e.g. Priya Verma" className="bg-surface border-line h-11" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="tm-phone">Mobile number</label>
                <Input id="tm-phone" name="phone" type="tel" inputMode="numeric" required placeholder="10-digit number" className="bg-surface border-line h-11" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className={labelCls}>Role</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Role">
              {(["COACH", "STAFF", "MANAGER"] as const).map((r) => {
                const disabled = r === "MANAGER" && !canMakeManager;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    disabled={disabled}
                    onClick={() => setRole(r)}
                    className={`h-11 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40 ${
                      role === r ? "border-volt bg-volt/10 text-volt-ink" : "border-line text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {r === "COACH" ? "Coach" : r === "STAFF" ? "Staff" : "Manager"}
                  </button>
                );
              })}
            </div>
            {role === "MANAGER" && <p className="text-xs text-ink-subtle">Managers can run everything except payment setup, billing and academy settings.</p>}
          </div>

          {role === "STAFF" && (
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="tm-staffrole">Job</label>
              <select id="tm-staffrole" value={staffRole} onChange={(e) => setStaffRole(e.target.value)} className={fieldCls}>
                {STAFF_ROLES.map((s) => (
                  <option key={s} value={s}>{STAFF_ROLE_LABELS[s]}</option>
                ))}
              </select>
              <p className="text-xs text-ink-subtle">
                {staffRole === "RECEPTIONIST" && "Can add students, handle enquiries and collect fees."}
                {staffRole === "ACCOUNTANT" && "Can collect fees, manage dues, see reports and handle salaries."}
                {staffRole === "GROUNDSMAN" && "Can manage facilities and bookings, and check in for the day."}
                {(staffRole === "PHYSIO" || staffRole === "OTHER") && "Can check in for the day. You can give more access later."}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="tm-title">Title (optional)</label>
            <Input id="tm-title" name="title" defaultValue={member?.title || ""} placeholder={role === "COACH" ? "e.g. Head cricket coach" : "e.g. Front desk"} className="bg-surface border-line h-11" />
          </div>

          {canSetPay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="tm-paytype">Pay</label>
                <select id="tm-paytype" value={payType} onChange={(e) => setPayType(e.target.value)} className={fieldCls}>
                  <option value="">Not set</option>
                  <option value="MONTHLY">Monthly salary</option>
                  <option value="PER_SESSION">Per session</option>
                </select>
              </div>
              {payType && (
                <div className="space-y-1.5">
                  <label className={labelCls} htmlFor="tm-payamount">Amount (₹)</label>
                  <Input id="tm-payamount" name="payAmount" type="number" min={0} step={1} required defaultValue={member?.payAmount ?? ""} placeholder={payType === "MONTHLY" ? "e.g. 25000" : "e.g. 500"} className="bg-surface border-line h-11" />
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-line hover:bg-surface h-11">Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-volt text-volt-fg hover:bg-volt-ink font-bold h-11">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save changes" : "Add to team"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
