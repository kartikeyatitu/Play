"use client";
// Redemption queue for staff. Coaches see their batches only (server-scoped). Used on /org/rewards and
// exported for the coach screen: <RedemptionsList /> loads its own data.

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { approveRedemption, cancelRedemption, declineRedemption, fulfilRedemption, listRedemptions } from "@/app/actions/rewards";
import { fmtDate, GhostButton, Panel, PrimaryButton, StatusText } from "./ui";

type List = Extract<Awaited<ReturnType<typeof listRedemptions>>, { ok: true }>["redemptions"];

export function RedemptionsList({ initial, onChange }: { initial?: List; onChange?: () => void }) {
  const [items, setItems] = useState<List>(initial ?? []);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [pending, start] = useTransition();

  const load = useCallback(
    () =>
      start(async () => {
        const r = await listRedemptions();
        if (r.ok) setItems(r.redemptions);
        else setError(r.error);
      }),
    [],
  );
  useEffect(() => {
    if (!initial) load();
  }, [initial, load]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong");
      else {
        toast.success(msg);
        load();
        onChange?.();
      }
    });

  const askNote = (q: string) => (typeof window !== "undefined" ? window.prompt(q) ?? undefined : undefined);
  const shown = filter === "open" ? items.filter((r) => r.status === "REQUESTED" || r.status === "APPROVED") : items;

  return (
    <Panel
      title="Reward requests"
      action={
        <select value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")} aria-label="Filter" className="min-h-[44px] rounded-xl border border-line bg-canvas px-3 text-sm text-ink">
          <option value="open">Open</option>
          <option value="all">All</option>
        </select>
      }
    >
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {shown.length === 0 ? <p className="text-sm text-ink-muted">{pending ? "Loading…" : "Nothing waiting."}</p> : null}
      <ul className="divide-y divide-line">
        {shown.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.studentName}</p>
                <p className="text-sm text-ink-muted">
                  {r.item} · {r.costPoints} pts{r.kind === "FEE_CREDIT" ? " · fee credit" : ""}
                </p>
                <p className="text-[11px] text-ink-subtle">
                  {fmtDate(r.createdAt)} · <StatusText status={r.status} />
                  {r.cancelReason ? ` · ${r.cancelReason}` : ""}
                </p>
              </div>
            </div>
            {r.status === "REQUESTED" || r.status === "APPROVED" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.status === "REQUESTED" && r.canApprove ? (
                  <PrimaryButton disabled={pending} onClick={() => act(() => approveRedemption(r.id, askNote("Note (optional)")), "Approved")}>
                    Approve
                  </PrimaryButton>
                ) : null}
                {r.status === "REQUESTED" ? (
                  <GhostButton tone="danger" disabled={pending} onClick={() => act(() => declineRedemption(r.id, askNote("Why? The parent sees this.")), "Declined, points returned")}>
                    Decline
                  </GhostButton>
                ) : null}
                {r.status === "APPROVED" && r.canApprove ? (
                  <PrimaryButton disabled={pending} onClick={() => act(() => fulfilRedemption(r.id), "Marked handed over")}>
                    Handed over
                  </PrimaryButton>
                ) : null}
                {r.status === "APPROVED" ? (
                  <GhostButton tone="danger" disabled={pending} onClick={() => act(() => cancelRedemption(r.id, askNote("Reason (optional)")), "Cancelled, points returned")}>
                    Cancel
                  </GhostButton>
                ) : null}
                {!r.canApprove && r.status === "REQUESTED" ? <p className="self-center text-xs text-ink-subtle">{r.kind === "FEE_CREDIT" ? "Owner approves fee credits" : "Your own child: another coach or the owner approves"}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
