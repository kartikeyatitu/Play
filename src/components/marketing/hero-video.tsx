import { ProductMock } from "./product-mock";

/**
 * Hero product walkthrough (attendance → coach note → fees → parent recap), 30s muted loop.
 * Server component: plain <video>, no hydration. Visitors with reduced motion get the static CSS mock instead.
 * All names and numbers in the video are illustrative sample data.
 */
export function HeroVideo() {
  return (
    <div className="w-full">
      <figure className="mx-auto w-full max-w-[640px] motion-reduce:hidden">
        <div className="overflow-hidden rounded-2xl border border-black/5 shadow-[0_30px_60px_-20px_rgba(30,42,26,0.35)]">
          <video
            className="block h-auto w-full bg-[#F6F4EC]"
            src="/media/triq-hero.mp4"
            poster="/media/triq-hero-poster.webp"
            width={1440}
            height={1080}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Triq walkthrough: a coach marks attendance, adds a note, logs a fee, and parents get a WhatsApp recap"
          />
        </div>
        <figcaption className="mt-3 text-center text-[11px] text-ink-subtle">Product preview · illustrative sample data</figcaption>
      </figure>
      <div className="hidden motion-reduce:block">
        <ProductMock />
      </div>
    </div>
  );
}
