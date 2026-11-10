"use client";
// Speech to text and text to speech using the phone's own browser (Web Speech API). No TRIQ server,
// no vendor key. Chrome on Android sends the audio to Google to transcribe; Safari uses Apple's.
// TRIQ never receives or stores audio: only the text the person chooses to save.

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceLang = "hi-IN" | "en-IN";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Allow the microphone for this site to speak a note.",
  "service-not-allowed": "Allow the microphone for this site to speak a note.",
  "no-speech": "Didn't hear anything. Tap the mic and speak.",
  network: "Speech needs internet. Type the note instead.",
  "audio-capture": "No microphone found.",
};

/**
 * Dictation. `onText` gets each finished phrase; `interim` shows the phrase being spoken.
 * Stops on its own after a pause; tap again to carry on.
 */
export function useDictation(lang: VoiceLang, onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => setSupported(!!recognitionCtor()), []);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    rec.current?.stop();
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onTextRef.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => setError(ERRORS[e.error] ?? "Couldn't hear that. Try again or type the note.");
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    setError(null);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone. Try again.");
    }
  }, [lang]);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, interim, error, start, stop };
}

/** Hindi when the text has Devanagari, otherwise Indian English. */
export function guessLang(text: string): VoiceLang {
  return /[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN";
}

/** Read text aloud with the phone's own voice. */
export function useReadAloud() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);
  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string, lang?: VoiceLang) => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang ?? guessLang(text);
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase()) && /IN/i.test(v.lang));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }, []);

  const cancel = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { supported, speaking, speak, cancel };
}
