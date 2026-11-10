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
  abort?(): void;
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
 * Dictation, one phrase per tap (continuous mode is unreliable in Chrome on Android: it can end at once
 * without an error). `onText` gets each finished phrase; `interim` shows the phrase being spoken.
 * `state` is idle → starting → listening → idle, so the button always shows that something happened.
 */
export function useDictation(lang: VoiceLang, onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "starting" | "listening">("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const heard = useRef(false);
  const failed = useRef(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => setSupported(!!recognitionCtor()), []);

  const stop = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    try {
      rec.current?.abort?.();
    } catch {
      /* ignore */
    }
    const r = new Ctor() as Recognition & { onstart?: (() => void) | null; onaudiostart?: (() => void) | null; abort?: () => void };
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    heard.current = false;
    failed.current = false;
    r.onstart = () => setState("listening");
    r.onaudiostart = () => setState("listening");
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) {
          if (t.trim()) {
            heard.current = true;
            onTextRef.current(t.trim());
          }
        } else live += t;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      failed.current = true;
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? "Couldn't hear that. Try again or type the note.");
    };
    r.onend = () => {
      setState("idle");
      setInterim("");
      if (!heard.current && !failed.current) setError("Didn't catch that. Tap the mic and speak right away.");
    };
    setError(null);
    setState("starting");
    try {
      navigator.vibrate?.(25);
    } catch {
      /* not supported */
    }
    rec.current = r;
    // Some phones never answer (no Google speech service, blocked mic). Don't leave the coach waiting.
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => {
      if (rec.current === r && !heard.current) {
        setState((st) => {
          if (st !== "starting") return st;
          failed.current = true;
          try {
            r.abort?.();
          } catch {
            /* ignore */
          }
          setError("The microphone didn't start on this phone. Tap the box and use the mic key on your keyboard instead.");
          return "idle";
        });
      }
    }, 5000);
    try {
      r.start();
    } catch {
      setState("idle");
      setError("Couldn't start the microphone. Close other apps using it and try again.");
    }
  }, [lang]);

  useEffect(
    () => () => {
      try {
        rec.current?.abort?.();
      } catch {
        /* ignore */
      }
    },
    [],
  );
  return { supported, state, listening: state !== "idle", interim, error, start, stop };
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
