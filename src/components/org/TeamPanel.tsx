"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Phone, Plus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addTeamMember, getTeam, markStaffAttendance, removeTeamMember, updateTeamMember } from "@/app/actions/team";
import { unwrap } from "@/lib/action-result";
import { haptic } from "@/lib/motion";
import { CountUp } from "@/components/ui/count-up";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { Bar } from "@/components/ui/meter";
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

const fieldCls = "w-full h-11 rounded-lg bg-surface border border-line px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt/30";
const labelCls = "text-[13px] font-medium text-ink-muted";

/* Role is information, not state: neutral chips, the owner gets a stronger outline */
const ROLE_TONE: Record<string, string> = {
  OWNER: "border-zinc-700 text-ink",
  MANAGER: "border-line text-ink-muted",
  COACH: "border-line text-ink-muted",
  STAFF: "border-line text-ink-muted",
};

/* Attendance is state: colour only on the selected segment */
const ATT_TONE: Record<StaffAttendanceStatus, string> = {
  PRESENT: "bg-success/15 text-success",
  HALF_DAY: "bg-warn/15 text-warn",
  LEAVE: "bg-sky-400/15 text-sky-400",
  ABSENT: "bg-danger/10 text-danger",
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
          <h2 className="text-2xl font-semibold text-ink tracking-[-0.025em]">Your team</h2>
          <p className="text-sm text-ink-subtle mt-1">
            {counts.coaches} coach{counts.coaches === 1 ? "" : "es"} · {counts.staff} staff · {counts.managers} owner/manager{counts.managers === 1 ? "" : "s"}
          </p>
        </div>
        {can("team.manage") && (
          <Button onClick={() => setAdding(true)} className="press bg-volt text-volt-fg hover:bg-lime-500 font-medium h-10 rounded-lg">
            <Plus className="w-4 h-4 mr-1.5" /> Add team member
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface shadow-hairline">
        <SummaryTile
          label="Checked in today"
          value={<><CountUp value={inToday.length} /><span className="text-ink-subtle">/{active.length}</span></>}
          meter={active.length > 0 ? <Bar value={(inToday.length / active.length) * 100} tone="success" /> : undefined}
        />
        <SummaryTile label="Not marked yet" value={<CountUp value={active.length - markedToday.length} />} />
        <SummaryTile label="On leave" value={<CountUp value={active.filter((m) => m.todayAttendance?.status === "LEAVE").length} />} />
      </div>

      {/* Members */}
      {active.length <= 1 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-subtle">
            <Plus className="w-[18px] h-[18px]" />
          </div>
          <p className="mt-3 text-sm font-medium text-ink">It's just you so far</p>
          <p className="text-[13px] text-ink-subtle mt-1 max-w-sm mx-auto">Add your coaches, receptionist, accountant and ground staff. Everyone logs in with their phone number.</p>
        </div>
      ) : null}

      <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-hairline">
        {active.map((m) => {
          const att = m.todayAttendance;
          const pay = formatPay(m);
          const isIn = att?.status === "PRESENT" || att?.status === "HALF_DAY";
          return (
            <li key={m.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="relative w-10 h-10 rounded-full bg-surface-2 border border-line flex items-center justify-center text-[13px] font-semibold text-ink-muted shrink-0">
                  {initials(m.name)}
                  {isIn && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-surface" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-ink truncate">{m.name}</span>
                    <span className={`text-[12px] font-medium px-1.5 py-px rounded-md border ${ROLE_TONE[m.role] || ROLE_TONE.STAFF}`}>
                      {roleLabel(m.role, m.staffRole)}
                    </span>
                    {m.title && <span className="text-[13px] text-ink-subtle">{m.title}</span>}
                    {m.status === "INVITED" && (
                      <span className="text-[12px] font-medium px-1.5 py-px rounded-md border border-line text-ink-subtle">Invite pending</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-subtle">
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 tabular-nums hover:text-ink">
                        <Phone className="w-3 h-3" /> {m.phone}
                      </a>
                    )}
                    {m.role === "COACH" && <span>{m.batches.length ? `${m.batches.length} batch${m.batches.length > 1 ? "es" : ""}` : "No batches yet"}</span>}
                    {pay && <span className="text-ink-muted tabular-nums">{pay}</span>}
                    {att?.checkInAt && (
                      <span className="text-success tabular-nums">
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
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-subtle hover:text-ink hover:bg-surface-2"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuFor === m.id && (
                      <div className="absolute right-0 top-10 z-20 w-48 rounded-lg border border-line bg-surface shadow-[0_8px_24px_-8px_rgb(var(--shadow-rgb)/0.2)] p-1">
                        <button type="button" className="w-full text-left px-3 py-2 rounded-md text-sm text-ink hover:bg-surface-2" onClick={() => { setMenuFor(null); setEditing(m); }}>
                          Edit role and pay
                        </button>
                        <button type="button" className="w-full text-left px-3 py-2 rounded-md text-sm text-danger hover:bg-surface-2 inline-flex items-center gap-2" onClick={() => remove(m)}>
                          <UserMinus className="w-3.5 h-3.5" /> Remove from team
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Today's attendance */}
              {can("team.manage") && m.status !== "INVITED" && (
                <div className="mt-3 sm:ml-[52px] flex items-center gap-3">
                  <span className="text-[13px] text-ink-subtle">Today</span>
                  <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={`Today's attendance for ${m.name}`}>
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
                          className={`press h-8 px-3 rounded-md text-[13px] font-medium transition-colors ${
                            on ? ATT_TONE[s] : "text-ink-muted hover:text-ink hover:bg-surface-2"
                          }`}
                          title={ATTENDANCE_LABELS[s]}
                        >
                          {ATT_SHORT[s]}
                        </button>
                      );
                    })}
                  </div>
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

function SummaryTile({ label, value, meter }: { label: string; value: React.ReactNode; meter?: React.ReactNode }) {
  return (
    <div className="min-w-0 p-3 sm:p-5">
      <div className="text-[12px] sm:text-[13px] font-medium text-ink-muted leading-tight truncate">{label}</div>
      <div className="num mt-2 text-[22px] sm:text-[28px] leading-none font-semibold text-ink">{value}</div>
      {meter && <div className="mt-3">{meter}</div>}
    </div>
  );
}

const initials = (name: string) =>
  name
    .replace(/^coach\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

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
        track("team_member_added", { role: String(base.role), staff_role: base.staffRole ? String(base.staffRole) : null, joined_other_academy: Boolean(res.invited) });
        await onSaved(res.invited ? `${name} works at another academy, so we've sent them an invite. They'll join once they accept it.` : `${name} added to your team`);
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
                      role === r ? "border-zinc-300 bg-surface-2 text-ink" : "border-line text-ink-muted hover:text-ink hover:border-zinc-700"
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
