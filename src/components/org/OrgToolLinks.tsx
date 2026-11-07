import { FEATURES } from "@/lib/features";

/** Links to academy tools that live on their own pages (not tabs). Shown under More. */
export function OrgToolLinks() {
  const links = [
    FEATURES.rewards && { href: "/org/rewards", label: "Rewards", hint: "Points, badges, reward catalogue and redemptions" },
    FEATURES.media && { href: "/org/media", label: "Photos", hint: "Upload and tag photos; families control who sees them" },
    FEATURES.waivers && { href: "/org/waivers", label: "Waivers & families", hint: "Versioned waivers, unsigned children, second guardians" },
    FEATURES.dataRequests && { href: "/org/data-requests", label: "Data requests", hint: "Export and deletion requests from families" },
    FEATURES.fixtures && { href: "/org/fixtures", label: "Fixtures & standings", hint: "Draws, schedules, results and tables" },
    FEATURES.triqBilling && { href: "/org/billing", label: "TRIQ billing", hint: "Your TRIQ plan invoices with GST" },
    { href: "/body", label: "Fitness & training", hint: "Fitness tests, drills and session plans" },
    { href: "/settings/notifications", label: "Notification settings", hint: "Choose which messages you receive" },
  ].filter(Boolean) as { href: string; label: string; hint: string }[];

  return (
    <section aria-label="Academy tools" className="mt-6 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Academy tools</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:bg-surface-2">
            <span>
              <span className="block text-sm font-semibold text-ink">{l.label}</span>
              <span className="block text-xs text-ink-muted">{l.hint}</span>
            </span>
            <span aria-hidden className="text-ink-subtle">→</span>
          </a>
        ))}
      </div>
    </section>
  );
}
