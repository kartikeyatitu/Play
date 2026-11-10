import { Check, IndianRupee, MapPin, MessageCircle, X } from "lucide-react";

/**
 * Hero "live product" composition — built in JSX/Tailwind (not a screenshot) so it stays crisp,
 * weighs nothing and animates with pure CSS. All names and numbers are illustrative sample data.
 */

const ROSTER: { name: string; present: boolean }[] = [
  { name: "Aarav S.", present: true },
  { name: "Ishita K.", present: true },
  { name: "Kabir M.", present: false },
  { name: "Myra D.", present: true },
  { name: "Vihaan R.", present: true },
];

function AttendanceRing({ present, total }: { present: number; total: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - present / total);
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgb(39 39 42)" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="mk-ring"
          style={{ ["--mk-c" as string]: `${c}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none text-ink">
          {present}/{total}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wider text-ink-subtle">present</span>
      </div>
    </div>
  );
}

function CoachTodayPhone() {
  return (
    <div className="relative mx-auto w-[min(100%,300px)] rounded-[2.2rem] border border-line bg-surface p-2 shadow-2xl shadow-black/60">
      <div className="overflow-hidden rounded-[1.8rem] bg-canvas">
        {/* status bar */}
        <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] text-ink-subtle">
          <span>5:42</span>
          <span className="h-4 w-16 rounded-full bg-surface" />
          <span>4G</span>
        </div>
        <div className="space-y-3 px-4 pb-5 pt-2">
          <div>
            <p className="text-[11px] text-ink-subtle">Coach app · Today</p>
            <p className="text-base font-semibold text-ink">Good evening, Coach 👋</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface/80 p-3">
            <div className="flex items-center gap-3">
              <AttendanceRing present={18} total={22} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">U-12 Cricket</p>
                <p className="text-[11px] text-ink-muted">5:30 – 7:00 PM</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-subtle">
                  <MapPin className="h-3 w-3" aria-hidden /> Sector 56 ground
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {ROSTER.map((s, i) => (
                <li
                  key={s.name}
                  className="mk-pop flex items-center justify-between rounded-lg bg-canvas/70 px-2.5 py-1.5 text-xs"
                  style={{ animationDelay: `${0.4 + i * 0.12}s` }}
                >
                  <span className="text-ink-muted">{s.name}</span>
                  {s.present ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-volt/15 text-volt">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                      <X className="h-3 w-3" aria-hidden />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-xl bg-[var(--brand)] py-2 text-center text-xs font-semibold text-volt-fg">
              Save & notify parents
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParentRecapCard() {
  return (
    <div className="w-full max-w-[280px] rounded-2xl border border-emerald-500/20 bg-surface/95 p-3.5 shadow-xl shadow-black/50 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink">Today&apos;s recap · Aarav</p>
          <p className="text-[10px] text-ink-subtle">Sent automatically to parent</p>
        </div>
      </div>
      <div className="space-y-1.5 rounded-xl bg-canvas/70 p-2.5 text-[11px] leading-relaxed text-ink-muted">
        <p>✅ Attended U-12 Cricket</p>
        <p>📝 Coach: &ldquo;Great footwork in the nets today.&rdquo;</p>
        <p>📅 Next session: Thu, 5:30 PM</p>
      </div>
    </div>
  );
}

function FeeWidget() {
  return (
    <div className="w-full max-w-[260px] rounded-2xl border border-line bg-surface/95 p-3.5 shadow-xl shadow-black/50 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-ink-muted">Fees collected · October</p>
        <span className="rounded-full bg-volt/10 px-2 py-0.5 text-[10px] font-semibold text-volt">78%</span>
      </div>
      <p className="mt-1 flex items-center text-2xl font-bold tracking-tight text-ink">
        <IndianRupee className="h-5 w-5" aria-hidden />
        42,500
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="mk-bar h-full w-[78%] rounded-full bg-gradient-to-r from-volt to-emerald-400" />
      </div>
      <div className="mk-pop mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-300" style={{ animationDelay: "1.4s" }}>
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="mk-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        ₹2,500 paid via UPI · Myra&apos;s parent · just now
      </div>
    </div>
  );
}

export function ProductMock() {
  return (
    <figure className="relative isolate mx-auto w-full max-w-[520px]">
      <div className="mk-glow pointer-events-none absolute -inset-10 -z-10" aria-hidden />
      {/* Mobile: stacked. Desktop: floating cards around the phone. */}
      <div className="relative flex flex-col items-center gap-4 lg:block lg:min-h-[560px]">
        <div className="w-full lg:absolute lg:left-1/2 lg:top-0 lg:w-[300px] lg:-translate-x-1/2">
          <div className="mk-float">
            <CoachTodayPhone />
          </div>
        </div>
        <div className="flex w-full justify-center lg:absolute lg:-left-6 lg:top-[330px] lg:z-10 lg:block lg:w-[280px]">
          <div className="mk-float-delayed w-full max-w-[280px]">
            <ParentRecapCard />
          </div>
        </div>
        <div className="flex w-full justify-center lg:absolute lg:-right-4 lg:top-16 lg:z-10 lg:block lg:w-[260px]">
          <div className="mk-float w-full max-w-[260px]">
            <FeeWidget />
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-[11px] text-ink-subtle">Product preview · illustrative sample data</figcaption>
    </figure>
  );
}
