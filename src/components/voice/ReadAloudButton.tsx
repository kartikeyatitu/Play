"use client";
// "Listen" for parents: reads a child's update aloud with the phone's own voice (Hindi or English).

import { Square, Volume2 } from "lucide-react";
import { useReadAloud, type VoiceLang } from "@/lib/voice/speech";

export function ReadAloudButton({ text, lang, label = "Listen", className = "" }: { text: string; lang?: VoiceLang; label?: string; className?: string }) {
  const { supported, speaking, speak, cancel } = useReadAloud();
  if (!supported || !text.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? cancel() : speak(text, lang))}
      aria-pressed={speaking}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-surface-2 ${className}`}
    >
      {speaking ? <Square className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      {speaking ? "Stop" : label}
    </button>
  );
}
