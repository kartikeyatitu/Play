"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type HeroLang = "en" | "hi";
export type HeroStrings = { title: string; sub: string; start: string; demo: string; note: string; offer: string };

const KEY = "triq-marketing-lang";

/** Headline, intro and actions, in English or Hindi. Strings come from the server so prices stay in src/lib/pricing.ts. */
export function Hero({ copy }: { copy: Record<HeroLang, HeroStrings> }) {
  const [lang, setLang] = useState<HeroLang>("en");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === "en" || v === "hi") setLang(v);
    } catch {
      /* storage unavailable: stay in English */
    }
  }, []);
  const pick = (l: HeroLang) => {
    setLang(l);
    try {
      window.localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  };
  const t = copy[lang];

  return (
    <div lang={lang}>
      <div role="group" aria-label="Language" className="mb-8 inline-flex gap-1 text-sm">
        {(["en", "hi"] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => pick(l)}
            className={`rounded-full px-3 py-1.5 font-semibold ${lang === l ? "bg-[var(--tq-ink)] text-[var(--tq-chalk)]" : "text-[var(--tq-muted)] hover:text-[var(--tq-ink)]"}`}
          >
            {l === "en" ? "English" : "हिंदी"}
          </button>
        ))}
      </div>

      <h1 className="tq-display text-[3.4rem] font-extrabold uppercase leading-[0.88] sm:text-7xl lg:text-[6.2rem]">{t.title}</h1>
      <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-[var(--tq-muted)]">{t.sub}</p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <Link href="/register" className="tq-btn tq-btn-primary">{t.start}</Link>
        <a href="#demo" className="tq-btn tq-btn-ghost">{t.demo}</a>
      </div>
      <p className="mt-5 text-sm text-[var(--tq-muted)]">{t.note}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--tq-turf)]">
        <Link href="#pricing" className="underline decoration-2 underline-offset-4 hover:no-underline">{t.offer}</Link>
      </p>
    </div>
  );
}
