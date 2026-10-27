import Image from "next/image";

/** Real photos from the founder's own badminton practice. Server component, no client JS. */
export function PhotoStrip() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-24" aria-labelledby="photo-strip-title">
      <div className="mx-auto max-w-6xl">
        <h2 id="photo-strip-title" className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Built by people who play sport.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-line bg-surface">
            <Image
              src="/marketing/badminton-court.webp"
              alt="Badminton practice session on a blue court"
              width={1200}
              height={640}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="h-auto w-full"
            />
            <figcaption className="px-5 py-4 text-sm text-ink-muted">Badminton practice</figcaption>
          </figure>
          <figure className="overflow-hidden rounded-2xl border border-line bg-surface">
            <Image
              src="/marketing/badminton-trophy.webp"
              alt="Founder holding a gold badminton trophy"
              width={1200}
              height={1174}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="h-auto w-full"
            />
            <figcaption className="px-5 py-4 text-sm text-ink-muted">Badminton trophy</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
