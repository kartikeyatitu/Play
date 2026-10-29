import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TriqMark, TriqWordmark } from "@/components/ui/triq-logo";
import "./marketing.css";

/** wa.me link for the sales WhatsApp number, or null when NEXT_PUBLIC_SALES_WHATSAPP is unset. */
export function salesWhatsAppHref(message = "Hi Triq team, I run a sports academy and would like to know more."): string | null {
  const digits = (process.env.NEXT_PUBLIC_SALES_WHATSAPP || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Brand mark (the T square from src/components/ui/triq-logo.tsx). Kept as an alias for older imports. */
export function LogoMark({ className, size = 30 }: { className?: string; size?: number }) {
  return <TriqMark size={size} className={className} />;
}

export const TAGLINE = "The operating system for sports";

export function Logo() {
  return (
    <Link href="/" className="flex items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-volt">
      <TriqWordmark size={30} />
      <span className="sr-only"> home</span>
    </Link>
  );
}

export function WhatsAppButton({
  message,
  label = "Chat on WhatsApp",
  className,
}: {
  message?: string;
  label?: string;
  className?: string;
}) {
  const href = salesWhatsAppHref(message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );
}

export const primaryCta =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-semibold text-volt-fg shadow-[0_0_30px_rgba(163,230,53,0.25)] transition-all hover:brightness-110 hover:shadow-[0_0_40px_rgba(163,230,53,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt";

export const secondaryCta =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface/60 px-6 text-sm font-semibold text-ink transition-colors hover:border-ink-subtle hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-canvas/75 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
          <Link href="/#features" className="hover:text-ink">Features</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/academies" className="hover:text-ink">Academies</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt">
            Log in
          </Link>
          <Link href="/register" className={cn(primaryCta, "h-9 px-4 text-sm shadow-none")}>
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm font-semibold text-ink">{TAGLINE}.</p>
          <p className="max-w-xs text-sm text-ink-muted">
            Attendance, fees, live scores and parent updates. Fees on time, parents informed, zero WhatsApp chaos. Built for sports coaches and academies.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Product</h2>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><Link href="/#features" className="hover:text-ink">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-ink">Pricing</Link></li>
            <li><Link href="/#demo" className="hover:text-ink">Book a demo</Link></li>
            <li><Link href="/register" className="hover:text-ink">Start free</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Directory</h2>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><Link href="/academies" className="hover:text-ink">Find academies</Link></li>
            <li><Link href="/parents" className="hover:text-ink">For parents</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Company</h2>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><Link href="/contact" className="hover:text-ink">Contact</Link></li>
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
            <li><Link href="/login" className="hover:text-ink">Log in</Link></li>
            <li><a href="https://www.instagram.com/kartikeya_yadav29/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Instagram</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-muted sm:px-6">
          © {new Date().getFullYear()} Triq.
        </p>
      </div>
    </footer>
  );
}

/** Shared chrome (nav + footer) for all public marketing pages. Server component. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-canvas text-ink selection:bg-volt/30">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <SiteNav />
      <div id="content">{children}</div>
      <SiteFooter />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("mb-12 max-w-2xl", align === "center" ? "mx-auto text-center" : "")}>
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-volt">{eyebrow}</p>}
      <h2 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-pretty text-base text-ink-muted sm:text-lg">{description}</p>}
    </div>
  );
}
