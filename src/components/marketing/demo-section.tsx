import { MessageCircle } from "lucide-react";
import { DemoForm } from "./demo-form";
import { SectionHeading, salesWhatsAppHref, WhatsAppButton } from "./shell";

export type MarketingSearchParams = Record<string, string | string[] | undefined>;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"] as const;

/** Build the JSON string stored in SalesLead.utm from a page's searchParams. */
export function buildUtm(searchParams: MarketingSearchParams | undefined, page: string): string {
  const out: Record<string, string> = { page };
  for (const key of UTM_KEYS) {
    const raw = searchParams?.[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) out[key] = String(value).slice(0, 100);
  }
  return JSON.stringify(out);
}

/** Demo section with form + WhatsApp. Anchor: #demo. */
export function DemoSection({
  utm,
  title = "Book a 15-minute demo",
  description = "We'll show you Triq on your own phone, with your batches — and answer every question about fees, parents and switching over.",
  defaultCity = "Gurgaon",
}: {
  utm: string;
  title?: string;
  description?: string;
  defaultCity?: string;
}) {
  const wa = salesWhatsAppHref("Hi Triq team, I'd like to book a 15-minute demo for my academy.");
  return (
    <section id="demo" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="lg:sticky lg:top-24">
          <SectionHeading align="left" eyebrow="Talk to a human" title={title} description={description} />
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-3"><span className="text-lime-400" aria-hidden>01</span> Tell us about your academy (1 minute).</li>
            <li className="flex gap-3"><span className="text-lime-400" aria-hidden>02</span> We WhatsApp you to pick a 15-minute slot — call or in person.</li>
            <li className="flex gap-3"><span className="text-lime-400" aria-hidden>03</span> Send us your registers or Excel; we set everything up for you.</li>
          </ul>
          {wa && (
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <MessageCircle className="h-4 w-4 text-emerald-400" aria-hidden />
              Prefer WhatsApp?
              <WhatsAppButton message="Hi Triq team, I'd like to book a 15-minute demo for my academy." label="Chat with us" className="h-10 px-4" />
            </div>
          )}
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-2xl shadow-black/40 sm:p-8">
          <DemoForm utm={utm} defaultCity={defaultCity} whatsappHref={wa} />
        </div>
      </div>
    </section>
  );
}
