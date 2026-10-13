import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact — Triq",
  description: "Talk to the Triq team about running your sports academy.",
};

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "kartikeya2998@gmail.com";
  const whatsappDigits = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, "");
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent("Hi, I'd like to know more about Triq for my academy.")}`
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid bg-orbs text-zinc-100 page-transition flex flex-col">
      {/* Nav */}
      <nav className="max-w-5xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/home" className="text-2xl font-black tracking-tight uppercase italic gradient-text">
          TRIQ
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
          <Link href="/home" className="hover:text-zinc-100 transition-colors">Home</Link>
          <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
          <Link href="/login" className="hover:text-zinc-100 transition-colors">Log in</Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-6 py-24 mx-auto max-w-3xl w-full text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
          <span className="gradient-text">Talk to us</span>
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          Questions about pricing, setting up your academy, or moving from registers
          and spreadsheets? Drop us a message — a real person replies, usually within a day.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center justify-center h-14 px-8 text-lg font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover-lift"
          >
            <Mail className="mr-2 w-5 h-5" /> Email us
          </a>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-14 px-8 text-lg font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-full hover-lift transition-all"
            >
              <MessageCircle className="mr-2 w-5 h-5" /> WhatsApp us
            </a>
          )}
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          {email}
          {!whatsappHref && " · WhatsApp support coming soon — email us for now."}
        </p>

        <div className="mt-20 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
          <h2 className="text-xl font-semibold mb-2 text-zinc-100">Want to just try it?</h2>
          <p className="text-zinc-400 mb-6">Triq is free to start. Set up your academy in minutes.</p>
          <Link
            href="/login"
            className="inline-flex items-center text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Create your academy <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 bg-zinc-950 py-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-2xl font-black tracking-tight uppercase italic gradient-text">TRIQ</div>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/home" className="hover:text-zinc-100">Home</Link>
            <Link href="/pricing" className="hover:text-zinc-100">Pricing</Link>
            <Link href="/login" className="hover:text-zinc-100">Log in</Link>
          </div>
          <p className="text-zinc-600 text-sm">© 2026 Triq</p>
        </div>
      </footer>
    </div>
  );
}
