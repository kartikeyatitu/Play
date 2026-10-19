import Link from "next/link";
import { MapPin, Star, Zap, ArrowRight } from "lucide-react";
import { type DirectoryItem, formatINR, getSport, sportName } from "@/lib/directory";

// Literal class strings (Tailwind JIT) for the generated covers — we have no academy photos,
// so each card gets a calm sport-tinted gradient with the sport glyph.
const COVER_TONES: Record<string, string> = {
  cricket: "from-emerald-500/25 via-emerald-500/5 to-transparent",
  football: "from-lime-400/25 via-lime-400/5 to-transparent",
  badminton: "from-sky-500/25 via-sky-500/5 to-transparent",
  tennis: "from-yellow-400/25 via-yellow-400/5 to-transparent",
  swimming: "from-cyan-400/25 via-cyan-400/5 to-transparent",
  basketball: "from-orange-500/25 via-orange-500/5 to-transparent",
  skating: "from-fuchsia-500/25 via-fuchsia-500/5 to-transparent",
  "table-tennis": "from-rose-500/25 via-rose-500/5 to-transparent",
  "martial-arts": "from-red-500/25 via-red-500/5 to-transparent",
  chess: "from-zinc-300/20 via-zinc-300/5 to-transparent",
  athletics: "from-amber-500/25 via-amber-500/5 to-transparent",
  "multi-sport": "from-violet-500/25 via-violet-500/5 to-transparent",
};

export function RatingLine({ rating, count, className = "" }: { rating: number | null; count: number | null; className?: string }) {
  if (rating == null) return null;
  return (
    <p className={`flex items-center gap-1 text-[13px] text-zinc-300 ${className}`}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold text-white">{rating.toFixed(1)}</span>
      {count != null && count > 0 && (
        <span className="text-zinc-500">
          · {formatINR(count)} Google review{count === 1 ? "" : "s"}
        </span>
      )}
    </p>
  );
}

export function AcademyCard({ item, priority = false }: { item: DirectoryItem; priority?: boolean }) {
  const primary = item.sports[0] ?? "multi-sport";
  const tone = COVER_TONES[primary] ?? COVER_TONES["multi-sport"];
  const glyph = getSport(primary)?.emoji ?? "🏅";
  const isOrg = item.kind === "org";
  const extraSports = item.sports.length - 3;

  return (
    <article
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-zinc-900/60 transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-900 ${
        isOrg ? "border-lime-400/25 hover:border-lime-400/50" : "border-white/[0.06] hover:border-white/15"
      }`}
    >
      {/* Cover */}
      <Link href={item.href} className="relative block aspect-[16/8] overflow-hidden" tabIndex={-1} aria-hidden>
        <div
          className={`absolute inset-0 bg-gradient-to-br ${tone}`}
          style={item.brandColor ? { backgroundImage: `linear-gradient(135deg, ${item.brandColor}40, transparent 70%)` } : undefined}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_45%)]" />
        {item.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.logo}
            alt=""
            loading={priority ? "eager" : "lazy"}
            className="absolute bottom-3 left-3 size-12 rounded-xl border border-white/10 object-cover shadow-lg"
          />
        ) : (
          <span className="absolute -bottom-3 right-3 select-none text-[64px] leading-none opacity-80 transition duration-500 group-hover:scale-110 group-hover:opacity-100">
            {glyph}
          </span>
        )}
        {isOrg ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-zinc-950/80 px-2.5 py-1 text-[11px] font-medium text-lime-300 backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-lime-400" />
            </span>
            On Triq · live batches &amp; fees
          </span>
        ) : item.area ? (
          <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full border border-white/10 bg-zinc-950/70 px-2.5 py-1 text-[11px] font-medium text-zinc-300 backdrop-blur">
            {item.area}
          </span>
        ) : null}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-snug tracking-tight text-white">
            <Link href={item.href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
              {item.name}
            </Link>
          </h3>
          <p className="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-zinc-400">
            <MapPin className="size-3.5 shrink-0 text-zinc-500" aria-hidden />
            <span className="truncate">{[item.area, item.cityName].filter(Boolean).join(", ")}</span>
          </p>
        </div>

        <RatingLine rating={item.rating} count={item.ratingCount} />

        {isOrg && (item.minFee != null || item.batchCount > 0) && (
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-zinc-300">
            {item.minFee != null && (
              <span>
                From <span className="font-semibold text-white">{item.minFee.toLocaleString()}</span>
                <span className="text-zinc-500">/mo</span>
              </span>
            )}
            {item.minFee != null && item.batchCount > 0 && <span className="text-zinc-700">·</span>}
            {item.batchCount > 0 && (
              <span className="text-zinc-400">
                {item.batchCount} batch{item.batchCount === 1 ? "" : "es"}
              </span>
            )}
          </p>
        )}

        {item.sports.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {item.sports.slice(0, 3).map((s) => (
              <li key={s} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-inset ring-white/[0.06]">
                {sportName(s)}
              </li>
            ))}
            {extraSports > 0 && (
              <li className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">+{extraSports}</li>
            )}
          </ul>
        )}

        {/* Actions sit above the stretched title link */}
        <div className="relative z-10 mt-auto flex gap-2 pt-1.5">
          <Link
            href={item.trialHref}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-lime-400 px-3 text-[13px] font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.98]"
          >
            <Zap className="size-3.5" aria-hidden />
            Book free trial
          </Link>
          <Link
            href={item.href}
            className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-white/10 px-3.5 text-[13px] font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.04]"
            aria-label={`View ${item.name}`}
          >
            View
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
