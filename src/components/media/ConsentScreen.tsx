"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMediaConsent, withdrawAllMediaConsent, type ChildMediaConsent } from "@/app/actions/media-consent";
import { Switch } from "@/components/ui/switch";
import { MEDIA_SCOPE_LABELS, MEDIA_SCOPES, type MediaScope } from "@/lib/media/constants";

/** Per-child photo consent: four switches, a plain notice and "withdraw all". Off by default. */
export function ConsentScreen({ initial, noticeVersion }: { initial: ChildMediaConsent[]; noticeVersion: string }) {
  const [children, setChildren] = useState(initial);
  const [pending, start] = useTransition();

  const update = (studentId: string, scopes: Partial<Record<MediaScope, boolean>>) =>
    setChildren((prev) => prev.map((c) => (c.studentId === studentId ? { ...c, scopes: { ...c.scopes, ...scopes } } : c)));

  const toggle = (child: ChildMediaConsent, scope: MediaScope, value: boolean) => {
    update(child.studentId, { [scope]: value });
    start(async () => {
      const r = await setMediaConsent(child.studentId, scope, value);
      if (!r.ok) {
        update(child.studentId, { [scope]: !value });
        toast.error(r.error);
      } else {
        toast.success(value ? "Allowed" : "Withdrawn. This applies straight away.");
      }
    });
  };

  const withdrawAll = (child: ChildMediaConsent) =>
    start(async () => {
      const r = await withdrawAllMediaConsent(child.studentId);
      if (!r.ok) return void toast.error(r.error);
      update(child.studentId, Object.fromEntries(MEDIA_SCOPES.map((s) => [s, false])) as Record<MediaScope, boolean>);
      toast.success("All photo sharing withdrawn");
    });

  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm text-ink">
        <h2 className="font-semibold">How photos of your child are used</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-muted">
          <li>Coaches and academy staff take photos at sessions, matches and tournaments. Academy staff can always see them.</li>
          <li>Nobody else sees a photo of your child unless you switch it on below. Everything starts off.</li>
          <li>If several children are in a photo, it is shared only when every child's parent has allowed it.</li>
          <li>Photos are never sold or used for advertising. No face recognition is used; staff tag children by hand.</li>
          <li>You can switch any option off at any time. It takes effect straight away.</li>
        </ul>
        <p className="text-xs text-ink-subtle">Notice version {noticeVersion}</p>
      </section>

      {children.length === 0 && <p className="text-sm text-ink-muted">No children are linked to your account.</p>}

      {children.map((child) => {
        const anyOn = MEDIA_SCOPES.some((s) => child.scopes[s]);
        return (
          <section key={child.studentId} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <header>
              <h2 className="text-base font-semibold text-ink">{child.name}</h2>
              {child.orgName && <p className="text-xs text-ink-muted">{child.orgName}</p>}
            </header>
            <ul className="divide-y divide-line">
              {MEDIA_SCOPES.map((scope) => {
                const id = `${child.studentId}-${scope}`;
                return (
                  <li key={scope} className="flex items-start justify-between gap-4 py-3">
                    <label htmlFor={id} className="space-y-0.5">
                      <span className="block text-sm font-medium text-ink">{MEDIA_SCOPE_LABELS[scope].title}</span>
                      <span className="block text-xs text-ink-muted">{MEDIA_SCOPE_LABELS[scope].body}</span>
                    </label>
                    <Switch id={id} checked={child.scopes[scope]} disabled={pending} onCheckedChange={(v) => toggle(child, scope, v)} className="mt-1 scale-125" />
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => withdrawAll(child)} disabled={pending || !anyOn}
              className="min-h-[48px] w-full rounded-xl border border-line text-sm font-medium text-danger disabled:opacity-40">
              Withdraw all photo sharing for {child.name}
            </button>
          </section>
        );
      })}
    </div>
  );
}
