"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ChevronLeft, ChevronRight, Copy, Loader2, Plus, Settings2, Share2, AlertTriangle, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState, shellButton } from "@/components/shell/EmptyState";
import {
  archiveFacility,
  createCounterBooking,
  getTurfBoard,
  saveFacility,
  updateBooking,
  type BookingAction,
  type TurfBoard as BoardData,
  type TurfBookingRow,
  type TurfFacility,
} from "@/app/actions/turf-bookings";
import { MAX_HOURS_PER_BOOKING, addDaysStr, formatDateLabel, formatHour, formatRange, rupees } from "@/lib/turf";

const ROW_PX = 52;
const field = "w-full min-h-[44px] rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-100 focus:outline-none focus:border-lime-400/60";
const label = "block text-xs text-zinc-400 mb-1";

function statusStyle(b: TurfBookingRow): { box: string; tag: string } {
  if (b.status === "PAID_CONFLICT") return { box: "bg-red-500/15 border-red-500/50 text-red-200", tag: "Needs attention" };
  if (b.status === "HOLD") return { box: "bg-sky-500/15 border-sky-500/40 text-sky-200", tag: "Awaiting payment" };
  if (b.status === "NO_SHOW") return { box: "bg-zinc-800/60 border-zinc-700 text-zinc-400", tag: "No-show" };
  if (b.status === "COMPLETED") return { box: "bg-zinc-800/60 border-zinc-700 text-zinc-300", tag: "Done" };
  const paidInFull = b.advancePaid >= b.amount;
  return paidInFull
    ? { box: "bg-emerald-500/15 border-emerald-500/40 text-emerald-100", tag: "Paid" }
    : { box: "bg-amber-500/15 border-amber-500/40 text-amber-100", tag: `${rupees(b.amount - b.advancePaid)} due` };
}

function waLink(phone: string, text: string) {
  return `https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;
}

export function TurfBoard() {
  const [date, setDate] = useState<string | null>(null);
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newFor, setNewFor] = useState<{ facilityId?: string; startHour?: number } | null>(null);
  const [selected, setSelected] = useState<TurfBookingRow | null>(null);
  const [editFacility, setEditFacility] = useState<TurfFacility | "new" | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeCourt, setActiveCourt] = useState<string | null>(null);

  const load = useCallback(async (d: string | null) => {
    setLoading(true);
    const res = await getTurfBoard(d ?? "");
    if ("error" in res) {
      setError(res.error);
    } else {
      setError(null);
      setData(res);
      setDate((cur) => cur ?? res.today);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const refresh = () => load(date);
  const facilities = data?.facilities ?? [];
  const shownCourt = activeCourt && facilities.some((f) => f.id === activeCourt) ? activeCourt : facilities[0]?.id ?? null;

  const publicUrl = useMemo(() => {
    if (!data?.slug || typeof window === "undefined") return "";
    return `${window.location.origin}/book/${data.slug}`;
  }, [data?.slug]);

  const summary = useMemo(() => {
    const live = (data?.bookings ?? []).filter((b) => ["CONFIRMED", "COMPLETED", "HOLD"].includes(b.status));
    return {
      count: live.length,
      hours: live.reduce((s, b) => s + b.hours, 0),
      expected: live.reduce((s, b) => s + b.amount, 0),
      due: live.filter((b) => b.status !== "HOLD").reduce((s, b) => s + Math.max(0, b.amount - b.advancePaid), 0),
    };
  }, [data?.bookings]);

  if (error) return <EmptyState title="Couldn't load bookings" description={error} />;
  if (!data || !date) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Bookings" description="Courts and turf" />
        <div className="h-64 rounded-xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
      </div>
    );
  }

  const header = (
    <SectionHeader
      title="Bookings"
      description={`${formatDateLabel(date)} · ${summary.count} booking${summary.count === 1 ? "" : "s"}`}
      actions={
        <>
          <button type="button" className={shellButton.quiet} onClick={() => setEditFacility("new")}>
            <Settings2 className="w-4 h-4" /> Courts
          </button>
          {facilities.length > 0 && (
            <button type="button" className={shellButton.primary} onClick={() => setNewFor({})}>
              <Plus className="w-4 h-4" /> New booking
            </button>
          )}
        </>
      }
    />
  );

  if (facilities.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState
          icon={<CalendarClock className="w-6 h-6" />}
          title="Add your first court or turf"
          description="Set a price per hour and opening hours. Then book walk-ins in seconds and share a link so customers can book and pay online."
          action={
            <button type="button" onClick={() => setEditFacility("new")} className={shellButton.primary}>
              Add a court / turf
            </button>
          }
        />
        {editFacility && <FacilityDialog facility={editFacility} onClose={() => setEditFacility(null)} onSaved={refresh} />}
      </div>
    );
  }

  // Grid time range = union of all courts' open windows
  const minHour = Math.min(...facilities.map((f) => f.openHour));
  const maxHour = Math.max(...facilities.map((f) => f.closeHour));
  const hoursList = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  const nowHourIst = date === data.today ? new Date(Date.now() + 5.5 * 3600_000).getUTCHours() : null;

  const visibleFacilities = facilities; // desktop shows all; mobile shows the selected one via CSS
  const mobileOnly = (id: string) => (id === shownCourt ? "" : "hidden sm:grid");

  return (
    <div className="space-y-4">
      {header}

      {data.pendingUpi.length > 0 && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-4 h-4" /> {data.pendingUpi.length} UPI payment{data.pendingUpi.length === 1 ? "" : "s"} to confirm
          </div>
          <p className="text-emerald-200/70">Check your UPI app or bank for each amount, then confirm. The slot stays blocked for a few hours.</p>
          {data.pendingUpi.map((u) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-black/20 p-2">
              <p className="flex-1 min-w-0">
                <span className="font-medium">{u.customerName}</span> ({u.customerPhone}) · {u.court} · {formatDateLabel(u.date)} {formatRange(u.startHour, u.hours)} · <b>{rupees(u.due)}</b>
                {u.ref ? <span className="text-emerald-200/70"> · ref {u.ref}</span> : null}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={shellButton.primary}
                  onClick={async () => {
                    const r = await updateBooking(u.id, "CONFIRM_UPI");
                    if (r.success) toast.success("Booking confirmed");
                    else toast.error(r.error || "Couldn't confirm");
                    refresh();
                  }}
                >
                  Received, confirm
                </button>
                <button
                  type="button"
                  className={shellButton.quiet}
                  onClick={async () => {
                    if (!window.confirm("Money not received? This releases the slot.")) return;
                    const r = await updateBooking(u.id, "REJECT_UPI");
                    if (r.success) toast.success("Slot released");
                    else toast.error(r.error || "Couldn't update");
                    refresh();
                  }}
                >
                  Not received
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.attention.length > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-4 h-4" /> {data.attention.length} booking{data.attention.length === 1 ? "" : "s"} need your attention
          </div>
          {data.attention.map((a) => (
            <p key={a.id}>
              {a.customerName} ({a.customerPhone}), {formatDateLabel(a.date)} {formatHour(a.startHour)}: {a.note}
            </p>
          ))}
        </div>
      )}

      {/* Share link */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-200">Your booking link</p>
          <p className="text-[11px] text-zinc-500 truncate font-mono">{publicUrl}</p>
          {!data.razorpayConnected && data.upiId && (
            <p className="text-[11px] text-emerald-400 mt-1">
              Customers pay the advance to your UPI ({data.upiId}) and you confirm it here. Connect Razorpay in Settings for automatic confirmation.
            </p>
          )}
          {!data.razorpayConnected && !data.upiId && (
            <p className="text-[11px] text-amber-400 mt-1">
              Customers can see free slots and message you on WhatsApp. Add your UPI ID (or connect Razorpay) in Settings to take advance payments online.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={shellButton.quiet}
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              setCopied(true);
              toast.success("Link copied");
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="w-4 h-4" /> {copied ? "Copied" : "Copy"}
          </button>
          <a
            className={shellButton.quiet}
            target="_blank"
            rel="noopener noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(`Book ${data.orgName} online: ${publicUrl}`)}`}
          >
            <Share2 className="w-4 h-4" /> Share
          </a>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous day" className={`${shellButton.quiet} !px-3`} onClick={() => setDate(addDaysStr(date, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${field} !w-auto flex-1 sm:flex-none`} aria-label="Pick a date" />
        <button type="button" aria-label="Next day" className={`${shellButton.quiet} !px-3`} onClick={() => setDate(addDaysStr(date, 1))}>
          <ChevronRight className="w-4 h-4" />
        </button>
        {date !== data.today && (
          <button type="button" className={shellButton.quiet} onClick={() => setDate(data.today)}>
            Today
          </button>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ["Bookings", String(summary.count)],
          ["Hours booked", String(summary.hours)],
          ["Booked value", rupees(summary.expected)],
          ["To collect", rupees(summary.due)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
            <p className="text-[11px] text-zinc-500">{k}</p>
            <p className="text-base font-semibold text-zinc-100 mt-0.5">{v}</p>
          </div>
        ))}
      </div>

      {/* Court tabs (mobile) */}
      {facilities.length > 1 && (
        <div className="flex gap-2 overflow-x-auto sm:hidden -mx-1 px-1 pb-1">
          {facilities.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveCourt(f.id)}
              className={`shrink-0 min-h-[40px] px-3.5 rounded-full text-xs font-medium border ${
                f.id === shownCourt ? "brand-bg border-transparent" : "border-zinc-800 bg-zinc-900/60 text-zinc-300"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Day grid */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-x-auto">
        <div className="flex min-w-full">
          <div className="shrink-0 w-14 border-r border-zinc-800">
            <div className="h-10 border-b border-zinc-800" />
            {hoursList.map((h) => (
              <div key={h} style={{ height: ROW_PX }} className="text-[11px] text-zinc-500 px-2 pt-1 border-b border-zinc-800/60">
                {formatHour(h)}
              </div>
            ))}
          </div>
          {visibleFacilities.map((f) => {
            const mine = data.bookings.filter((b) => b.facilityId === f.id);
            return (
              <div key={f.id} className={`min-w-[170px] flex-1 border-r border-zinc-800 last:border-r-0 ${f.id === shownCourt ? "" : "hidden sm:block"}`}>
                <div className="h-10 border-b border-zinc-800 px-3 flex items-center justify-between">
                  <button type="button" className="text-xs font-semibold text-zinc-100 truncate text-left" onClick={() => setEditFacility(f)} title="Edit court">
                    {f.name}
                  </button>
                  <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{rupees(f.hourlyRate)}/hr</span>
                </div>
                <div className={`grid ${mobileOnly(f.id)}`} style={{ gridTemplateRows: `repeat(${hoursList.length}, ${ROW_PX}px)` }}>
                  {hoursList.map((h, i) => {
                    const open = h >= f.openHour && h < f.closeHour;
                    const covered = mine.some((b) => h >= b.startHour && h < b.startHour + b.hours);
                    if (covered) return null;
                    const past = nowHourIst !== null && h < nowHourIst;
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={!open}
                        onClick={() => setNewFor({ facilityId: f.id, startHour: h })}
                        style={{ gridRow: i + 1 }}
                        className={`border-b border-zinc-800/60 text-[11px] transition-colors ${
                          !open
                            ? "bg-zinc-950/60 text-zinc-700 cursor-not-allowed"
                            : past
                              ? "text-zinc-600 hover:bg-zinc-900"
                              : "text-zinc-500 hover:bg-lime-400/10 hover:text-lime-300"
                        }`}
                        aria-label={`Book ${f.name} at ${formatHour(h)}`}
                      >
                        {open ? "+" : "closed"}
                      </button>
                    );
                  })}
                  {mine.map((b) => {
                    const st = statusStyle(b);
                    const row = b.startHour - minHour + 1;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelected(b)}
                        style={{ gridRow: `${row} / span ${b.hours}` }}
                        className={`m-0.5 rounded-lg border px-2 py-1.5 text-left overflow-hidden ${st.box}`}
                      >
                        <p className="text-xs font-semibold truncate">{b.customerName}</p>
                        <p className="text-[11px] opacity-80 truncate">
                          {formatRange(b.startHour, b.hours)} · {st.tag}
                        </p>
                        {b.source === "LEASE" && <p className="text-[10px] opacity-70">Weekly lease</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {newFor && (
        <NewBookingDialog
          facilities={facilities}
          date={date}
          today={data.today}
          initial={newFor}
          onClose={() => setNewFor(null)}
          onSaved={() => {
            setNewFor(null);
            refresh();
          }}
        />
      )}
      {selected && (
        <BookingDialog
          booking={selected}
          facility={facilities.find((f) => f.id === selected.facilityId)}
          orgName={data.orgName}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
      {editFacility && <FacilityDialog facility={editFacility} onClose={() => setEditFacility(null)} onSaved={refresh} />}
    </div>
  );
}

/* ───────────────────────── New booking ───────────────────────── */

function NewBookingDialog({
  facilities,
  date: initialDate,
  today,
  initial,
  onClose,
  onSaved,
}: {
  facilities: TurfFacility[];
  date: string;
  today: string;
  initial: { facilityId?: string; startHour?: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const first = facilities.find((f) => f.id === initial.facilityId) ?? facilities[0];
  const [facilityId, setFacilityId] = useState(first.id);
  const [date, setDate] = useState(initialDate);
  const [startHour, setStartHour] = useState(initial.startHour ?? first.openHour);
  const [hours, setHours] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<string>(String(first.hourlyRate));
  const [amountEdited, setAmountEdited] = useState(false);
  const [received, setReceived] = useState("0");
  const [repeat, setRepeat] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const facility = facilities.find((f) => f.id === facilityId) ?? first;
  const startOptions = Array.from({ length: facility.closeHour - facility.openHour }, (_, i) => facility.openHour + i);
  const maxHours = Math.min(MAX_HOURS_PER_BOOKING, facility.closeHour - startHour);

  useEffect(() => {
    if (startHour < facility.openHour || startHour >= facility.closeHour) setStartHour(facility.openHour);
  }, [facility, startHour]);
  useEffect(() => {
    if (hours > maxHours) setHours(Math.max(1, maxHours));
  }, [maxHours, hours]);
  useEffect(() => {
    if (!amountEdited) setAmount(String(facility.hourlyRate * hours));
  }, [facility, hours, amountEdited]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await createCounterBooking({
      facilityId,
      date,
      startHour,
      hours,
      customerName: name,
      customerPhone: phone,
      amount: Number(amount),
      advancePaid: Number(received) || 0,
      repeatWeeks: repeat,
      notes,
    });
    setSaving(false);
    if (!res.success) return void toast.error(res.error);
    if (res.conflicts.length > 0) {
      toast.warning(`Booked ${res.created}. Skipped ${res.conflicts.length} date${res.conflicts.length === 1 ? "" : "s"} that were already taken: ${res.conflicts.map(formatDateLabel).join(", ")}`);
    } else {
      toast.success(res.created > 1 ? `Booked ${res.created} weeks` : "Booking saved");
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Court</label>
              <select className={field} value={facilityId} onChange={(e) => { setFacilityId(e.target.value); setAmountEdited(false); }}>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({rupees(f.hourlyRate)}/hr)</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Date</label>
              <input type="date" className={field} value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className={label}>Starts</label>
              <select className={field} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
                {startOptions.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Duration</label>
              <select className={field} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {Array.from({ length: Math.max(1, maxHours) }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Repeat weekly</label>
              <select className={field} value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
                <option value={1}>Just this once</option>
                <option value={4}>4 weeks</option>
                <option value={8}>8 weeks</option>
                <option value={12}>12 weeks</option>
                <option value={26}>26 weeks</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={label}>{repeat > 1 ? "Academy / customer name" : "Customer name"}</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" required maxLength={80} />
            </div>
            <div className="col-span-2">
              <label className={label}>Mobile number</label>
              <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="10-digit mobile" required />
            </div>
            <div>
              <label className={label}>{repeat > 1 ? "Price per session (₹)" : "Total price (₹)"}</label>
              <input className={field} type="number" min={0} value={amount} onChange={(e) => { setAmount(e.target.value); setAmountEdited(true); }} required />
            </div>
            <div>
              <label className={label}>Received now (₹)</label>
              <input className={field} type="number" min={0} value={received} onChange={(e) => setReceived(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={label}>Note (optional)</label>
              <input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="e.g. Birthday match, bring own ball" />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">{formatDateLabel(date)} · {formatRange(startHour, hours)}{repeat > 1 ? ` · every week for ${repeat} weeks` : ""}</p>
          <button type="submit" disabled={saving} className={`${shellButton.primary} w-full`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {saving ? "Saving…" : repeat > 1 ? `Book ${repeat} weeks` : "Confirm booking"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Booking details ───────────────────────── */

function BookingDialog({
  booking: b,
  facility,
  orgName,
  onClose,
  onChanged,
}: {
  booking: TurfBookingRow;
  facility?: TurfFacility;
  orgName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<BookingAction | null>(null);
  const balance = Math.max(0, b.amount - b.advancePaid);
  const st = statusStyle(b);

  async function run(action: BookingAction, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(action);
    const res = await updateBooking(b.id, action);
    setBusy(null);
    if (!res.success) return void toast.error(res.error || "Couldn't update");
    toast.success("Updated");
    onChanged();
  }

  const msg = `Hi ${b.customerName}, your booking at ${orgName} (${facility?.name ?? "court"}) is confirmed for ${formatDateLabel(b.date)}, ${formatRange(b.startHour, b.hours)}.${balance > 0 ? ` Balance ${rupees(balance)} to pay at the venue.` : " Fully paid. See you there!"}`;
  const live = b.status === "CONFIRMED";
  const btn = "min-h-[44px] px-3 rounded-xl border text-sm font-medium disabled:opacity-50";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{b.customerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className={`rounded-xl border px-3 py-2.5 text-sm ${st.box}`}>
            <p className="font-semibold">{facility?.name ?? "Court"}</p>
            <p className="text-xs opacity-90">{formatDateLabel(b.date)} · {formatRange(b.startHour, b.hours)}</p>
            <p className="text-xs opacity-90 mt-1">{st.tag}{b.source === "ONLINE" ? " · booked online" : b.source === "LEASE" ? " · weekly lease" : ""}</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Total", rupees(b.amount)],
              ["Received", rupees(b.advancePaid)],
              ["Balance", rupees(balance)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-zinc-950 border border-zinc-800 py-2">
                <dt className="text-[11px] text-zinc-500">{k}</dt>
                <dd className="text-sm font-semibold text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-zinc-400">📞 {b.customerPhone}</p>
          {b.notes && <p className="text-xs text-zinc-400">📝 {b.notes}</p>}

          <div className="grid grid-cols-2 gap-2">
            <a className={`${btn} border-emerald-600/50 text-emerald-300 flex items-center justify-center gap-1.5`} target="_blank" rel="noopener noreferrer" href={waLink(b.customerPhone, msg)}>
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a className={`${btn} border-zinc-700 text-zinc-200 flex items-center justify-center`} href={`tel:${b.customerPhone}`}>Call</a>
            {live && balance > 0 && (
              <button className={`${btn} col-span-2 brand-bg border-transparent`} disabled={!!busy} onClick={() => run("COLLECT_BALANCE")}>
                {busy === "COLLECT_BALANCE" ? "Saving…" : `Mark ${rupees(balance)} collected`}
              </button>
            )}
            {live && (
              <>
                <button className={`${btn} border-zinc-700 text-zinc-200`} disabled={!!busy} onClick={() => run("COMPLETE")}>Mark done</button>
                <button className={`${btn} border-zinc-700 text-zinc-200`} disabled={!!busy} onClick={() => run("NO_SHOW")}>No-show</button>
              </>
            )}
            {["CONFIRMED", "HOLD", "PAID_CONFLICT"].includes(b.status) && (
              <button
                className={`${btn} col-span-2 border-rose-500/40 text-rose-300`}
                disabled={!!busy}
                onClick={() => run("CANCEL", b.advancePaid > 0 ? `Cancel this booking? ${rupees(b.advancePaid)} was received. Refund it from your Razorpay dashboard or in cash.` : "Cancel this booking?")}
              >
                {busy === "CANCEL" ? "Cancelling…" : "Cancel booking"}
              </button>
            )}
            {live && b.source === "LEASE" && (
              <button className={`${btn} col-span-2 border-rose-500/30 text-rose-300/90`} disabled={!!busy} onClick={() => run("CANCEL_SERIES", "Cancel this and all later weeks of this lease?")}>
                Cancel this + all later weeks
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Court settings ───────────────────────── */

function FacilityDialog({ facility, onClose, onSaved }: { facility: TurfFacility | "new"; onClose: () => void; onSaved: () => void }) {
  const editing = facility !== "new" ? facility : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState(editing?.type ?? "TURF");
  const [rate, setRate] = useState(String(editing?.hourlyRate ?? 1000));
  const [open, setOpen] = useState(editing?.openHour ?? 6);
  const [close, setClose] = useState(editing?.closeHour ?? 23);
  const [advance, setAdvance] = useState(String(editing?.advanceAmount ?? 0));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveFacility({ id: editing?.id, name, type, hourlyRate: Number(rate), openHour: open, closeHour: close, advanceAmount: Number(advance) || 0 });
    setSaving(false);
    if (!res.success) return void toast.error(res.error);
    toast.success(editing ? "Court updated" : "Court added");
    onSaved();
    onClose();
  }

  async function archive() {
    if (!editing || !confirm(`Remove ${editing.name}? Past bookings are kept.`)) return;
    const res = await archiveFacility(editing.id);
    if (!res.success) return void toast.error(res.error || "Couldn't remove");
    toast.success("Court removed");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a court / turf"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Name</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Turf 1 (7-a-side)" required maxLength={60} />
            </div>
            <div>
              <label className={label}>Type</label>
              <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="TURF">Turf</option>
                <option value="COURT">Court</option>
                <option value="NET">Cricket net</option>
                <option value="INDOOR">Indoor</option>
              </select>
            </div>
            <div>
              <label className={label}>Price per hour (₹)</label>
              <input className={field} type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} required />
            </div>
            <div>
              <label className={label}>Opens</label>
              <select className={field} value={open} onChange={(e) => setOpen(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Closes</label>
              <select className={field} value={close} onChange={(e) => setClose(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{h === 24 ? "12 AM (midnight)" : formatHour(h)}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={label}>Online advance (₹) — 0 means customers pay the full amount online</label>
              <input className={field} type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={saving} className={`${shellButton.primary} w-full`}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add court"}
          </button>
          {editing && (
            <button type="button" onClick={archive} className="w-full min-h-[44px] rounded-xl border border-rose-500/30 text-rose-300 text-sm">
              Remove this court
            </button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
