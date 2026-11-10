"use client";
// Small mic for any text box: speak (Hindi or English), the words are added to the box for review.
// Uses the phone's own speech-to-text; TRIQ never receives audio. Hidden where the browser can't do it.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useDictation, type VoiceLang } from "@/lib/voice/speech";

const LANG_KEY = "triq-voice-lang";

function readLang(fallback: VoiceLang): VoiceLang {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "hi-IN" || v === "en-IN" ? v : fallback;
  } catch {
    return fallback;
  }
}

export function MicButton({
  onText,
  defaultLang = "hi-IN",
  fixedLang,
  className = "",
  label = "Speak",
  tone = "dark",
}: {
  /** Gets each finished phrase. The caller appends it to its text box. */
  onText: (phrase: string) => void;
  defaultLang?: VoiceLang;
  /** Skip the language switch (e.g. English for searching names). */
  fixedLang?: VoiceLang;
  className?: string;
  label?: string;
  tone?: "dark" | "light";
}) {
  const [lang, setLang] = useState<VoiceLang>(fixedLang ?? defaultLang);
  useEffect(() => {
    if (!fixedLang) setLang(readLang(defaultLang));
  }, [fixedLang, defaultLang]);
  const d = useDictation(lang, onText);

  useEffect(() => {
    if (d.error) toast.error(d.error);
  }, [d.error]);

  if (!d.supported) return null;

  const switchLang = () => {
    const next: VoiceLang = lang === "hi-IN" ? "en-IN" : "hi-IN";
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const base = tone === "dark" ? "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800" : "border-line bg-surface text-ink hover:bg-surface-2";
  return (
    <span className={`inline-flex shrink-0 items-center overflow-hidden rounded-full border ${base} ${className}`}>
      {!fixedLang && (
        <button
          type="button"
          onClick={switchLang}
          aria-label={`Speaking language: ${lang === "hi-IN" ? "Hindi" : "English"}. Tap to switch.`}
          className="h-9 px-2.5 text-xs font-semibold opacity-80 hover:opacity-100"
        >
          {lang === "hi-IN" ? "हिं" : "EN"}
        </button>
      )}
      <button
        type="button"
        onClick={() => (d.listening ? d.stop() : d.start())}
        aria-pressed={d.listening}
        aria-label={d.listening ? "Stop listening" : label}
        title={d.state === "listening" ? d.interim || "Listening… speak now" : label}
        className={`flex h-9 items-center gap-1.5 px-3 text-xs font-semibold ${d.listening ? "bg-red-600 text-white" : ""}`}
      >
        {d.state === "starting" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : d.state === "listening" ? (
          <MicOff className="h-4 w-4 animate-pulse" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{d.state === "listening" ? "Listening…" : d.state === "starting" ? "Starting…" : label}</span>
      </button>
    </span>
  );
}

/** Append a spoken phrase to existing text with a space. */
export const appendPhrase = (current: string, phrase: string) => (current.trim() ? `${current.replace(/\s+$/, "")} ${phrase}` : phrase);
