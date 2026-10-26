"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { getMyAcademies, getMyInvites, respondToInvite, switchAcademy } from "@/app/actions/team";
import { unwrap } from "@/lib/action-result";
import { roleLabel } from "@/lib/team";

type Academy = Awaited<ReturnType<typeof getMyAcademies>>[number];
type Invite = Awaited<ReturnType<typeof getMyInvites>>[number];

/** Invitations to join another academy. Nothing changes until the person accepts. */
function AcademyInvites({ className = "", onAccepted }: { className?: string; onAccepted: () => void }) {
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMyInvites().then(setInvites).catch(() => setInvites([]));
  }, []);

  if (!invites.length) return null;

  async function respond(invite: Invite, accept: boolean) {
    setBusy(invite.id);
    try {
      unwrap(await respondToInvite(invite.id, accept));
      setInvites((list) => list.filter((i) => i.id !== invite.id));
      toast.success(accept ? `You've joined ${invite.academyName}` : "Invitation declined");
      if (accept) onAccepted();
    } catch (err: any) {
      toast.error(err?.message || "Couldn't update the invitation");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className={`space-y-2 ${className}`}>
      {invites.map((i) => (
        <li key={i.id} className="rounded-lg border border-line bg-surface p-3 text-sm">
          <p className="text-ink">
            <span className="font-semibold">{i.academyName}</span>
            {i.city ? `, ${i.city}` : ""} invited you to join as {roleLabel(i.role, i.staffRole)}.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy === i.id}
              onClick={() => respond(i, true)}
              className="press h-9 px-3 rounded-lg bg-ink text-surface text-[13px] font-medium disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy === i.id}
              onClick={() => respond(i, false)}
              className="press h-9 px-3 rounded-lg border border-line text-ink-muted text-[13px] font-medium disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Pending academy invitations, plus a switcher for people who work at more than one academy. */
export function AcademySwitcher({ className = "" }: { className?: string }) {
  const [academies, setAcademies] = React.useState<Academy[]>([]);
  const [switching, setSwitching] = React.useState(false);

  const load = React.useCallback(() => {
    getMyAcademies().then(setAcademies).catch(() => setAcademies([]));
  }, []);
  React.useEffect(load, [load]);

  const active = academies.find((a) => a.active);
  const invites = <AcademyInvites className={className} onAccepted={load} />;
  if (academies.length < 2) return invites;

  return (
    <>
    {invites}
    <label className={`inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 h-11 text-sm ${className}`}>
      <ArrowLeftRight className="w-4 h-4 text-ink-subtle shrink-0" aria-hidden />
      <span className="sr-only">Switch academy</span>
      <select
        value={active?.orgId}
        disabled={switching}
        onChange={async (e) => {
          setSwitching(true);
          try {
            const res = unwrap(await switchAcademy(e.target.value));
            window.location.href = res.redirectTo;
          } catch (err: any) {
            toast.error(err?.message || "Couldn't switch academy");
            setSwitching(false);
          }
        }}
        className="bg-transparent text-ink font-medium focus:outline-none max-w-[14rem] truncate"
      >
        {academies.map((a) => (
          <option key={a.orgId} value={a.orgId} className="bg-surface">
            {a.name} · {roleLabel(a.role, a.staffRole)}
          </option>
        ))}
      </select>
    </label>
    </>
  );
}
