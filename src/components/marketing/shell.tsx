import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import "./marketing.css";

/** wa.me link for the sales WhatsApp number, or null when NEXT_PUBLIC_SALES_WHATSAPP is unset. */
export function salesWhatsAppHref(message = "Hi Triq team, I run a sports academy and would like to know more."): string | null {
  const digits = (process.env.NEXT_PUBLIC_SALES_WHATSAPP || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-[10px] font-black tracking-tight text-zinc-950",
        className,
      )}
    >
      TRQ
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400">
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-zinc-50">Triq</span>
      <span className="sr-only">— home</span>
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
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-semibold text-zinc-950 shadow-[0_0_30px_rgba(163,230,53,0.25)] transition-all hover:brightness-110 hover:shadow-[0_0_40px_rgba(163,230,53,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400";

export const secondaryCta =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-6 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/75 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <Link href="/#features" className="hover:text-zinc-100">Features</Link>
          <Link href="/pricing" className="hover:text-zinc-100">Pricing</Link>
          <Link href="/academies" className="hover:text-zinc-100">Academies</Link>
          <Link href="/#faq" className="hover:text-zinc-100">FAQ</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white">
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
    <footer className="border-t border-white/5 bg-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-zinc-400">
            Fees on time, parents informed, zero WhatsApp chaos. Built for sports coaches and academies.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Product</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/#features" className="hover:text-zinc-100">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-zinc-100">Pricing</Link></li>
            <li><Link href="/#demo" className="hover:text-zinc-100">Book a demo</Link></li>
            <li><Link href="/register" className="hover:text-zinc-100">Start free</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Directory</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/academies" className="hover:text-zinc-100">Find academies</Link></li>
            <li><Link href="/parents" className="hover:text-zinc-100">For parents</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Company</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/contact" className="hover:text-zinc-100">Contact</Link></li>
            <li><Link href="/privacy" className="hover:text-zinc-100">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-zinc-100">Terms</Link></li>
            <li><Link href="/login" className="hover:text-zinc-100">Log in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-zinc-400 sm:px-6">
          © {new Date().getFullYear()} Triq.
        </p>
      </div>
    </footer>
  );
}

/** Shared chrome (nav + footer) for all public marketing pages. Server component. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100 selection:bg-lime-400/30">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-zinc-900 focus:px-4 focus:py-2"
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
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">{eyebrow}</p>}
      <h2 className="text-balance text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-pretty text-base text-zinc-400 sm:text-lg">{description}</p>}
    </div>
  );
}
