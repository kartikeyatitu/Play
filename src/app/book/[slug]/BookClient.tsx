"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CheckCircle2, MessageCircle, MapPin, Clock } from "lucide-react";
import {
  getPublicAvailability,
  startOnlineBooking,
  releaseHold,
  confirmTurfCheckout,
  startUpiBooking,
  reportUpiPaid,
  type PublicVenue,
  type ConfirmResult,
  type StartUpiResult,
} from "../actions";
import { addDaysStr, formatDateLabel, formatHour, formatRange, rupees } from "@/lib/turf";

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loader: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = RAZORPAY_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      s.remove();
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(s);
  });
  return loader;
}

type Facility = PublicVenue["facilities"][number];

export function BookClient({ venue }: { venue: PublicVenue }) {
  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysStr(venue.today, i)), [venue.today]);
  const [date, setDate] = useState(venue.today);
  const [courtId, setCourtId] = useState(venue.facilities[0].id);
  const [busy, setBusy] = useState<Record<string, number[]>>({});
  const [nowHour, setNowHour] = useState<number | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [hours, setHours] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Extract<ConfirmResult, { success: true }>["summary"] | null>(null);
  const submittingRef = useRef(false);
  const [upi, setUpi] = useState<Extract<StartUpiResult, { success: true }> | null>(null);
  const [qr, setQr] = useState("");
  const [utr, setUtr] = useState("");
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState<{ late: boolean } | null>(null);

  useEffect(() => {
    if (!upi) return setQr("");
    let cancelled = false;
    import("qrcode")
      .then((Q) => Q.toDataURL(upi.upiLink, { margin: 1, width: 220 }))
      .then((url) => !cancelled && setQr(url))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [upi]);

  const court: Facility = venue.facilities.find((f) => f.id === courtId) ?? venue.facilities[0];

  const refresh = useCallback(async () => {
    setLoadingAvail(true);
    const res = await getPublicAvailability(venue.slug, date);
    if ("error" in res) {
      setError(res.error);
    } else {
      setBusy(res.busy);
      setNowHour(res.nowHour);
    }
    setLoadingAvail(false);
  }, [venue.slug, date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setStartHour(null);
    setHours(1);
  }, [date, courtId]);

  const taken = useMemo(() => new Set(busy[court.id] ?? []), [busy, court.id]);
  const hoursList = useMemo(() => Array.from({ length: court.closeHour - court.openHour }, (_, i) => court.openHour + i), [court]);
  const isPast = (h: number) => nowHour !== null && h <= nowHour;
  const isFree = (h: number) => !taken.has(h) && !isPast(h);

  // how many consecutive free hours from the selected start (capped at 6)
  const maxHours = useMemo(() => {
    if (startHour === null) return 0;
    let n = 0;
    while (n < 6 && startHour + n < court.closeHour && isFree(startHour + n)) n++;
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startHour, taken, nowHour, court]);

  const total = court.hourlyRate * hours;
  const onlineDue = court.advanceAmount > 0 ? Math.min(court.advanceAmount, total) : total;
  const balance = total - onlineDue;
  const waPhone = venue.phone ? venue.phone.replace(/\D/g, "").replace(/^0+/, "") : "";
  const waLink = (msg: string) => `https://wa.me/${waPhone.length === 10 ? "91" + waPhone : waPhone}?text=${encodeURIComponent(msg)}`;

  function pickHour(h: number) {
    if (!isFree(h)) return;
    setError("");
    setStartHour(h);
    setHours(1);
  }

  async function pay() {
    if (submittingRef.current || startHour === null) return;
    setError("");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (phone.replace(/\D/g, "").length < 10) return setError("Please enter a valid 10-digit mobile number.");
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await startOnlineBooking({ slug: venue.slug, facilityId: court.id, date, startHour, hours, name, phone });
      if (!res.success) {
        setError(res.error);
        void refresh();
        return release();
      }
      await loadRazorpay();
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Razorpay unavailable");
      const rzp = new Razorpay({
        key: res.keyId,
        amount: res.amountMinor,
        currency: "INR",
        name: res.venue,
        description: res.description,
        order_id: res.orderId,
        prefill: res.prefill,
        theme: { color: "#d1440a" },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const c = await confirmTurfCheckout({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            if (c.success) setDone(c.summary);
            else setError(c.error);
          } catch {
            setError("We couldn't confirm your payment. If money was deducted, the venue will contact you.");
          } finally {
            void refresh();
            release();
          }
        },
        modal: {
          ondismiss: () => {
            void releaseHold(res.bookingId);
            void refresh();
            release();
          },
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        setError(resp?.error?.description || "Payment failed. Please try again.");
      });
      rzp.open();
    } catch {
      setError("Couldn't start the payment. Please try again.");
      release();
    }
  }

  function release() {
    submittingRef.current = false;
    setSubmitting(false);
  }

  async function payUpi() {
    if (submittingRef.current || startHour === null) return;
    setError("");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (phone.replace(/\D/g, "").length < 10) return setError("Please enter a valid 10-digit mobile number.");
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await startUpiBooking({ slug: venue.slug, facilityId: court.id, date, startHour, hours, name, phone });
      if (!res.success) {
        setError(res.error);
        void refresh();
        return;
      }
      setUpi(res);
    } catch {
      setError("Couldn't start the booking. Please try again.");
    } finally {
      release();
    }
  }

  async function iHavePaid() {
    if (!upi || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const r = await reportUpiPaid({ bookingId: upi.bookingId, phone, utr });
      if (r.success) setReported({ late: r.late });
      else setError(r.error);
    } catch {
      setError("Couldn't send this. Please try again.");
    } finally {
      release();
    }
  }

  async function cancelUpi() {
    if (upi) void releaseHold(upi.bookingId);
    setUpi(null);
    setUtr("");
    void refresh();
  }

  if (reported && upi) {
    const msg = `Hi, I booked ${upi.description} on ${formatDateLabel(date)} at ${venue.name} and paid ${rupees(upi.amount)} by UPI. Name: ${name}.${utr ? ` Ref: ${utr}.` : ""}`;
    return (
      <Shell venue={venue}>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-center">
          <Clock className="w-12 h-12 text-amber-300 mx-auto" />
          <h2 className="text-xl font-bold mt-3">{reported.late ? "Payment noted" : "Waiting for the venue to confirm"}</h2>
          <p className="text-zinc-400 text-sm mt-1">
            {reported.late
              ? "Your hold had expired, so the venue will check the slot and contact you."
              : `Your slot is reserved. ${venue.name} will confirm once they see your ${rupees(upi.amount)} UPI payment.`}
          </p>
          <div className="mt-5 rounded-xl bg-zinc-900 p-4 text-left space-y-2 text-sm">
            <Row k="Booking" v={upi.description} />
            <Row k="Date" v={formatDateLabel(date)} />
            <Row k="You paid" v={rupees(upi.amount)} />
          </div>
          {waPhone && (
            <a href={waLink(msg)} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-emerald-500 text-zinc-950 font-bold">
              <MessageCircle className="w-4 h-4" /> Message the venue
            </a>
          )}
        </div>
      </Shell>
    );
  }

  if (upi) {
    return (
      <Shell venue={venue}>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="text-center">
            <p className="text-xs text-zinc-400">Pay {venue.name} by UPI</p>
            <p className="text-3xl font-bold mt-1">{rupees(upi.amount)}</p>
            <p className="text-xs text-zinc-500 mt-1">{upi.description} · {formatDateLabel(date)}</p>
          </div>
          {qr && <img src={qr} alt="UPI QR code" className="mx-auto rounded-lg bg-[#fff] p-2 w-48 h-48" />}
          <a href={upi.upiLink} className="flex items-center justify-center w-full h-12 rounded-xl bg-lime-400 text-zinc-950 font-bold">
            Open UPI app to pay
          </a>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(upi.upiId);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="w-full text-center text-sm text-zinc-300"
          >
            Or pay to <span className="font-mono text-emerald-400">{upi.upiId}</span> {copied && <span className="text-xs text-zinc-500">copied</span>}
          </button>
          <p className="text-[11px] text-zinc-500 text-center">Your slot is held for {upi.holdMinutes} minutes. After paying, tap the button below.</p>
          <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UPI reference no. (optional)" className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-700 px-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-lime-400" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={iHavePaid} disabled={submitting} className="w-full h-12 rounded-xl border border-lime-400 text-lime-300 font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} I&apos;ve paid
          </button>
          <button onClick={cancelUpi} className="w-full text-xs text-zinc-500 underline">Cancel and release the slot</button>
        </div>
      </Shell>
    );
  }

  if (done) {
    const msg = `Hi, I booked ${done.court} on ${formatDateLabel(done.date)}, ${formatRange(done.startHour, done.hours)} at ${done.venue}. Name: ${name}.`;
    return (
      <Shell venue={venue}>
        <div className="rounded-2xl border border-lime-400/30 bg-lime-400/5 p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-lime-400 mx-auto" />
          <h2 className="text-xl font-bold mt-3">You&apos;re booked!</h2>
          <p className="text-zinc-400 text-sm mt-1">{done.venue}</p>
          <div className="mt-5 rounded-xl bg-zinc-900 p-4 text-left space-y-2 text-sm">
            <Row k="Court" v={done.court} />
            <Row k="Date" v={formatDateLabel(done.date)} />
            <Row k="Time" v={formatRange(done.startHour, done.hours)} />
            <Row k="Paid online" v={rupees(done.paid)} />
            {done.balance > 0 && <Row k="Pay at venue" v={rupees(done.balance)} />}
          </div>
          {waPhone && (
            <a href={waLink(msg)} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-emerald-500 text-zinc-950 font-bold">
              <MessageCircle className="w-4 h-4" /> Message the venue
            </a>
          )}
          <button onClick={() => { setDone(null); setStartHour(null); setName(""); setPhone(""); }} className="mt-3 text-sm text-zinc-400 underline">
            Book another slot
          </button>
        </div>
      </Shell>
    );
  }

  const waMsg = startHour !== null ? `Hi, I'd like to book ${court.name} on ${formatDateLabel(date)}, ${formatRange(startHour, hours)} (${rupees(total)}). Name: ${name || "-"}.` : "";

  return (
    <Shell venue={venue}>
      {/* date strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {dates.map((d) => {
          const active = d === date;
          const [wd, rest] = formatDateLabel(d).split(", ");
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`snap-start shrink-0 w-16 rounded-xl py-2 text-center border transition ${active ? "bg-lime-400 text-zinc-950 border-lime-400" : "bg-zinc-900 border-zinc-800 text-zinc-300"}`}
            >
              <div className="text-[11px] uppercase opacity-70">{d === venue.today ? "Today" : wd}</div>
              <div className="text-sm font-bold">{(rest ?? "").replace(/ /, "\u00a0")}</div>
            </button>
          );
        })}
      </div>

      {/* courts */}
      {venue.facilities.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto -mx-4 px-4">
          {venue.facilities.map((f) => (
            <button key={f.id} onClick={() => setCourtId(f.id)} className={`shrink-0 px-4 h-10 rounded-full text-sm font-medium border ${f.id === court.id ? "bg-white text-zinc-950 border-white" : "bg-zinc-900 border-zinc-800 text-zinc-300"}`}>
              {f.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-zinc-300">
          <span className="font-semibold text-white">{court.name}</span> · {court.type}
        </div>
        <div className="text-lime-400 font-semibold">{court.hourlyRate > 0 ? `${rupees(court.hourlyRate)}/hr` : "Price on request"}</div>
      </div>

      {/* hour grid */}
      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2 min-h-24">
        {loadingAvail ? (
          <div className="col-span-full flex justify-center py-6 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          hoursList.map((h) => {
            const free = isFree(h);
            const inSel = startHour !== null && h >= startHour && h < startHour + hours;
            return (
              <button
                key={h}
                disabled={!free}
                onClick={() => pickHour(h)}
                className={`h-12 rounded-xl text-sm font-medium border transition ${
                  inSel ? "bg-lime-400 text-zinc-950 border-lime-400" : free ? "bg-zinc-900 border-zinc-700 text-white hover:border-lime-400/60" : "bg-zinc-950 border-zinc-900 text-zinc-700 line-through"
                }`}
              >
                {formatHour(h)}
              </button>
            );
          })
        )}
      </div>
      <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Crossed-out slots are taken or already started.</p>

      {/* selection */}
      {startHour !== null && (
        <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
          <div>
            <div className="text-xs text-zinc-400 mb-2">How long?</div>
            <div className="flex gap-2">
              {Array.from({ length: Math.max(maxHours, 1) }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setHours(n)} className={`flex-1 h-10 rounded-lg text-sm font-semibold border ${hours === n ? "bg-lime-400 text-zinc-950 border-lime-400" : "bg-zinc-950 border-zinc-700"}`}>
                  {n}h
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-white font-semibold">{formatRange(startHour, hours)}</div>
              <div className="text-xs text-zinc-400">{formatDateLabel(date)}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{rupees(total)}</div>
              {(venue.onlinePayments || venue.upi) && balance > 0 && <div className="text-xs text-zinc-400">Pay {rupees(onlineDue)} now · {rupees(balance)} at venue</div>}
            </div>
          </div>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className="w-full h-12 rounded-xl bg-zinc-950 border border-zinc-700 px-4 text-white placeholder:text-zinc-600 outline-none focus:border-lime-400" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" inputMode="tel" autoComplete="tel" className="w-full h-12 rounded-xl bg-zinc-950 border border-zinc-700 px-4 text-white placeholder:text-zinc-600 outline-none focus:border-lime-400" />

          {error && <p className="text-sm text-red-400">{error}</p>}

          {(venue.onlinePayments || venue.upi) && court.hourlyRate > 0 ? (
            <button onClick={venue.onlinePayments ? pay : payUpi} disabled={submitting} className="w-full h-12 rounded-xl bg-lime-400 text-zinc-950 font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {venue.onlinePayments ? "Opening secure payment…" : "Holding your slot…"}</> : <>{venue.onlinePayments ? `Pay ${rupees(onlineDue)} & confirm` : `Pay ${rupees(onlineDue)} by UPI`}</>}
            </button>
          ) : waPhone ? (
            <a href={waLink(waMsg)} target="_blank" rel="noreferrer" className="w-full h-12 rounded-xl bg-emerald-500 text-zinc-950 font-bold flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" /> Request this slot on WhatsApp
            </a>
          ) : (
            <p className="text-sm text-zinc-400">Online booking isn&apos;t set up yet. Please contact the venue.</p>
          )}
          {venue.onlinePayments && <p className="text-[11px] text-zinc-500 text-center">Your slot is held for 10 minutes while you pay. Secured by Razorpay.</p>}
          {!venue.onlinePayments && venue.upi && <p className="text-[11px] text-zinc-500 text-center">Pay by any UPI app. The venue confirms your booking after checking the payment.</p>}
        </div>
      )}
      {startHour === null && error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-400">{k}</span>
      <span className="text-white font-medium">{v}</span>
    </div>
  );
}

function Shell({ venue, children }: { venue: PublicVenue; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">{venue.name}</h1>
          {venue.city && <p className="text-sm text-zinc-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" />{venue.city}</p>}
        </header>
        {children}
        <p className="text-center text-[11px] text-zinc-600 mt-10">Powered by Triq</p>
      </div>
    </div>
  );
}
