"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck } from "lucide-react";

export type HeroLang = "en" | "hi";

export type HeroCopyStrings = {
  eyebrow: string;
  titleA: string;
  titleB: string;
  sub: string;
  startFree: string;
  bookDemo: string;
  micro: string[];
};

const STORAGE_KEY = "triq-marketing-lang";

/**
 * The only interactive part of the hero: an English/Hindi toggle.
 * Copy for both languages is passed in from the server so pricing numbers stay in src/lib/pricing.ts.
 */
export function HeroCopy({
  copy,
  primaryClass,
  secondaryClass,
}: {
  copy: Record<HeroLang, HeroCopyStrings>;
  primaryClass: string;
  secondaryClass: string;
}) {
  const [lang, setLang] = useState<HeroLang>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "hi" || saved === "en") setLang(saved);
    } catch {
      // storage unavailable (private mode) — keep English
    }
  }, []);

  const choose = (next: HeroLang) => {
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const t = copy[lang];

  return (
    <div lang={lang === "hi" ? "hi" : "en"} className="flex flex-col items-center text-center lg:items-start lg:text-left">
      <div role="group" aria-label="Language" className="mb-6 inline-flex rounded-full border border-zinc-800 bg-zinc-900/70 p-1 text-xs font-semibold">
        {(["en", "hi"] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => choose(l)}
            className={
              "rounded-full px-3 py-1.5 transition-colors " +
              (lang === l ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100")
            }
          >
            {l === "en" ? "English" : "हिंदी"}
          </button>
        ))}
      </div>

      <Link
        href="/register"
        className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1.5 text-xs font-medium text-lime-300 hover:bg-lime-400/15"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="mk-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
        </span>
        <span className="truncate">{t.eyebrow}</span>
        <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
      </Link>

      <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
        {t.titleA}{" "}
        <span className="bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400 bg-clip-text text-transparent">{t.titleB}</span>
      </h1>

      <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">{t.sub}</p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link href="/register" className={primaryClass}>
          {t.startFree} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <a href="#demo" className={secondaryClass}>
          <CalendarCheck className="h-4 w-4" aria-hidden /> {t.bookDemo}
        </a>
      </div>

      <ul className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-zinc-400 lg:justify-start">
        {t.micro.map((m) => (
          <li key={m} className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-lime-400" aria-hidden />
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
