import Image from "next/image";
import Link from "next/link";
import { SportIcon } from "@/components/sport/SportIcon";
import { FOUNDING_OFFER, FREE_PLAN } from "@/lib/pricing";

const SPORTS: { key: string; name: string }[] = [
  { key: "cricket", name: "Cricket" },
  { key: "football", name: "Football" },
  { key: "badminton", name: "Badminton" },
  { key: "tennis", name: "Tennis" },
  { key: "table_tennis", name: "Table tennis" },
  { key: "basketball", name: "Basketball" },
  { key: "hockey", name: "Hockey" },
  { key: "athletics", name: "Athletics" },
  { key: "swimming", name: "Swimming" },
  { key: "chess", name: "Chess" },
];

export function SportsRow() {
  return (
    <section aria-label="Sports" className="border-y border-[var(--tq-line)] bg-[var(--tq-paper)] px-4 py-6 sm:px-6">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-[var(--tq-muted)]">
        {SPORTS.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <SportIcon sport={s.key} className="h-5 w-5 text-[var(--tq-turf)]" />
            {s.name}
          </li>
        ))}
        <li className="text-[var(--tq-muted)]">and 12 more</li>
      </ul>
    </section>
  );
}

/** One evening, three people. A real sequence, so it is drawn as a timeline. */
export function OneSession() {
  const steps = [
    {
      time: "5:30 pm",
      who: "Coach",
      title: "Marks the batch in a minute",
      body: "Tap present, late or absent on the phone, add one line about a child who did well. Works on a weak signal.",
      mock: (
        <div className="space-y-1.5 text-sm">
          {[
            ["Aarav S.", "Present"],
            ["Riya K.", "Present"],
            ["Ishaan M.", "Late"],
            ["Meher P.", "Absent"],
          ].map(([n, s]) => (
            <div key={n} className="flex items-center justify-between rounded-lg bg-[var(--tq-chalk)] px-3 py-2">
              <span>{n}</span>
              <span className={`text-xs font-semibold ${s === "Absent" ? "text-[#a3372a]" : s === "Late" ? "text-[#8a5a00]" : "text-[var(--tq-turf)]"}`}>{s}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      time: "7:00 pm",
      who: "Parent",
      title: "Sees their own child's evening",
      body: "A private page on WhatsApp: attended, the coach's note, the next session. No group chat, no app to install.",
      mock: (
        <div className="rounded-xl bg-[#e7f6ec] p-3 text-sm leading-relaxed">
          <p className="font-semibold">Aarav attended U-12 nets</p>
          <p className="mt-1 text-[var(--tq-muted)]">Coach: &ldquo;Front-foot drive much better today. Keep the head still.&rdquo;</p>
          <p className="mt-1 text-[var(--tq-muted)]">Next: Thursday, 5:30 pm</p>
        </div>
      ),
    },
    {
      time: "Next morning",
      who: "Owner",
      title: "Knows who has paid",
      body: "Fees paid by UPI mark themselves. A polite reminder goes only to families who still owe, and stops once they pay.",
      mock: (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between rounded-lg bg-[var(--tq-chalk)] px-3 py-2">
            <span>Collected this month</span>
            <span className="tq-num text-xl font-extrabold">₹1,24,500</span>
          </div>
          <div className="flex items-baseline justify-between rounded-lg bg-[var(--tq-chalk)] px-3 py-2">
            <span>Still due</span>
            <span className="tq-num text-xl font-extrabold text-[#a3372a]">₹9,000</span>
          </div>
        </div>
      ),
    },
  ];
  return (
    <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="tq-display max-w-3xl text-5xl font-extrabold uppercase leading-[0.92] sm:text-6xl">One session. Three people who stop chasing each other.</h2>
        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <div className="tq-rail absolute left-0 right-0 top-[11px] hidden md:block" aria-hidden />
          {steps.map((s) => (
            <li key={s.who} className="relative">
              <div className="flex items-center gap-3">
                <span className="relative z-10 h-6 w-6 rounded-full border-[3px] border-[var(--tq-turf)] bg-[var(--tq-chalk)]" aria-hidden />
                <span className="tq-num relative z-10 bg-[var(--tq-chalk)] pr-3 text-2xl font-extrabold text-[var(--tq-turf)]">{s.time}</span>
              </div>
              <p className="mt-5 text-sm font-semibold text-[var(--tq-muted)]">{s.who}</p>
              <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 max-w-sm leading-relaxed text-[var(--tq-muted)]">{s.body}</p>
              <div className="mt-5 rounded-2xl border border-[var(--tq-line)] bg-[var(--tq-paper)] p-3">{s.mock}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Everything else, grouped by who it is for. Plain rows, not a card wall. */
export function Pillars() {
  const rows = [
    {
      name: "Academy",
      line: "The office work, done once.",
      items: ["Enrolment and trials", "Batches and schedules", "Attendance", "Fees, UPI and reminders", "GST invoices", "Coach payroll", "Leads", "Calendar and courts"],
    },
    {
      name: "Coaches",
      line: "A coach app built for the side of the field.",
      items: ["Today's batches", "Skill rubrics for 12 sports", "Fitness tests and drills", "Session plans", "Rewards for effort", "Mind and performance exercises"],
    },
    {
      name: "Parents",
      line: "Their child, not the whole group chat.",
      items: ["A private page per child", "Pay online", "Photos only they approve", "Badges and rewards", "Two guardians per child"],
    },
    {
      name: "Athletes",
      line: "A record that grows with them.",
      items: ["Athlete passport", "Personal bests", "Live scores in 22 sports", "Tournaments, draws and tables"],
    },
    {
      name: "Connect",
      line: "Help beyond the coach, verified first.",
      items: ["Physiotherapists", "Nutritionists", "Sports psychologists", "Booked by the parent"],
    },
  ];
  return (
    <section aria-labelledby="pillars-title" className="border-t border-[var(--tq-line)] px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 id="pillars-title" className="tq-display text-5xl font-extrabold uppercase leading-[0.92] sm:text-6xl">Everything an academy runs on</h2>
        <div className="mt-12 divide-y divide-[var(--tq-line)] border-y border-[var(--tq-line)]">
          {rows.map((r) => (
            <div key={r.name} className="grid gap-3 py-7 md:grid-cols-[14rem_1fr] md:gap-10">
              <div>
                <h3 className="tq-display text-4xl font-extrabold uppercase leading-none text-[var(--tq-turf)]">{r.name}</h3>
                <p className="mt-2 text-sm text-[var(--tq-muted)]">{r.line}</p>
              </div>
              <ul className="flex flex-wrap content-start gap-x-2 gap-y-2 md:pt-1">
                {r.items.map((i) => (
                  <li key={i} className="rounded-full bg-[var(--tq-paper)] px-3.5 py-1.5 text-[15px] ring-1 ring-[var(--tq-line)]">{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Most of the people in TRIQ are children. This is the promise, on the darkest panel on the page. */
export function ChildSafe() {
  const promises = [
    ["No public profiles for children", "A child's page is seen by their family and their academy. Nobody can search for them."],
    ["Parents decide on photos", "Each family chooses who can see photos of their child, and can change it any time."],
    ["Medical details only with consent", "Allergies and emergency contacts are stored only after a parent agrees, and are shown to coaches in an emergency."],
    ["Missing a session never costs points", "Rewards are for turning up and trying. A sick week is never a lost streak."],
  ];
  return (
    <section aria-labelledby="safe-title" className="px-4 sm:px-6">
      <div className="tq-board mx-auto max-w-6xl px-6 py-14 sm:px-12 sm:py-16">
        <h2 id="safe-title" className="tq-display max-w-2xl text-5xl font-extrabold uppercase leading-[0.92] text-[#ffffff] sm:text-6xl">Built for children first</h2>
        <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {promises.map(([t, d]) => (
            <div key={t}>
              <dt className="text-lg font-bold text-[var(--tq-amber)]">{t}</dt>
              <dd className="mt-1.5 leading-relaxed text-[#c9d6ce]">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-sm text-[#9fb5a9]">
          Families can ask for a copy of their data, or for it to be deleted, from the app. <Link href="/privacy" className="underline underline-offset-4 hover:text-[#ffffff]">Read the privacy policy</Link>.
        </p>
      </div>
    </section>
  );
}

/** The founder's own court, and the offer to move an academy over. */
export function SwitchOver() {
  return (
    <section aria-labelledby="switch-title" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <figure className="overflow-hidden rounded-2xl">
          <Image
            src="/marketing/badminton-court.webp"
            alt="Badminton practice on a blue court"
            width={1200}
            height={640}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="h-auto w-full"
          />
          <figcaption className="mt-2 text-xs text-[var(--tq-muted)]">Our own Tuesday practice. TRIQ is built by people who play.</figcaption>
        </figure>
        <div>
          <h2 id="switch-title" className="tq-display text-5xl font-extrabold uppercase leading-[0.92] sm:text-6xl">Send us your register. We do the rest.</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--tq-muted)]">
            A photo of the register, an Excel sheet or the WhatsApp group list is enough. We set up your batches, fee plans and students in {FOUNDING_OFFER.migrationHours} hours, and your coaches get a login on WhatsApp.
          </p>
          <p className="mt-4 max-w-lg leading-relaxed text-[var(--tq-muted)]">
            Free up to {FREE_PLAN.maxStudents} students. The first {FOUNDING_OFFER.slots} founding academies get {FOUNDING_OFFER.discountPercent}% off for {FOUNDING_OFFER.months} months.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="tq-btn tq-btn-primary">Start free</Link>
            <a href="#demo" className="tq-btn tq-btn-ghost">Book a 15-minute demo</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFaq({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.6fr]">
        <h2 id="faq-title" className="tq-display text-5xl font-extrabold uppercase leading-[0.92] sm:text-6xl">Questions owners ask</h2>
        <div className="divide-y divide-[var(--tq-line)] border-y border-[var(--tq-line)]">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex items-start justify-between gap-6 text-lg font-semibold">
                {f.q}
                <span className="tq-plus mt-0.5 text-2xl leading-none text-[var(--tq-turf)]" aria-hidden>+</span>
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-[var(--tq-muted)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingBoard() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="tq-board mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-14 sm:px-12 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="tq-display max-w-2xl text-5xl font-extrabold uppercase leading-[0.92] text-[#ffffff] sm:text-7xl">Tonight&rsquo;s batch could be your first on TRIQ</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/register" className="tq-btn tq-btn-light">Start free</Link>
          <a href="#demo" className="tq-btn border-[1.5px] border-[#ffffff99] text-[#ffffff] hover:bg-[#ffffff] hover:text-[var(--tq-pitch)]">Book a demo</a>
        </div>
      </div>
    </section>
  );
}
