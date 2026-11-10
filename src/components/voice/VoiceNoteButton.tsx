"use client";
// Coach: a note about one child for today's session, spoken (Hindi or English) or typed.
// The coach always reads and edits the text before saving; parents see only the saved text.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, MicOff, NotebookPen, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { saveSessionNote } from "@/app/actions/attendance";
import { useDictation, type VoiceLang } from "@/lib/voice/speech";

const LANG_KEY = "triq-voice-lang";
const MAX = 500;

function savedLang(): VoiceLang {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "en-IN" ? "en-IN" : "hi-IN";
  } catch {
    return "hi-IN";
  }
}

export function VoiceNoteButton({
  batchId,
  studentId,
  studentName,
  initialNote,
  canNote,
}: {
  batchId: string;
  studentId: string;
  studentName: string;
  initialNote?: string | null;
  /** Attendance must be marked before a note can be saved. */
  canNote: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(initialNote ?? "");
  const [lang, setLang] = useState<VoiceLang>("hi-IN");
  const [pending, start] = useTransition();
  const first = studentName.split(" ")[0] || studentName;

  const dictation = useDictation(lang, (phrase) => {
    if (!phrase) return;
    setText((t) => {
      const joined = t.trim() ? `${t.trim()} ${phrase}` : phrase;
      return joined.slice(0, MAX);
    });
  });

  const pickLang = (l: VoiceLang) => {
    if (dictation.listening) dictation.stop();
    setLang(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const save = () =>
    start(async () => {
      if (dictation.listening) dictation.stop();
      const r = await saveSessionNote(batchId, studentId, text);
      if (!r.success) return void toast.error(r.error);
      setSaved(text.trim());
      toast.success(text.trim() ? `Note saved. ${first}'s parents will see it.` : "Note removed.");
      setOpen(false);
      router.refresh();
    });

  const hasNote = !!saved.trim();

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setLang(savedLang());
          setText(saved);
        } else if (dictation.listening) dictation.stop();
        setOpen(o);
      }}
      title={`Note about ${first}`}
      description={`Today's session. ${first}'s parents see this note.`}
      trigger={
        <button
          type="button"
          disabled={!canNote}
          aria-label={hasNote ? `Edit note about ${first}` : `Add a note about ${first}`}
          title={canNote ? (hasNote ? "Edit note" : "Add a note") : "Mark attendance first"}
          className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
            hasNote ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <NotebookPen className="w-4 h-4" />
        </button>
      }
    >
      <div className="space-y-4">
        {dictation.supported && (
          <div className="flex flex-col items-center gap-3">
            <div role="group" aria-label="Language you will speak" className="inline-flex rounded-full border border-line p-1 text-sm">
              {(["hi-IN", "en-IN"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => pickLang(l)}
                  className={`rounded-full px-3.5 py-1.5 font-semibold ${lang === l ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"}`}
                >
                  {l === "hi-IN" ? "हिंदी" : "English"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? "Stop listening" : "Speak the note"}
              className={`h-20 w-20 rounded-full flex items-center justify-center transition-colors ${
                dictation.listening ? "bg-danger text-white animate-pulse" : "brand-bg"
              }`}
            >
              {dictation.listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
            <p className="min-h-5 text-center text-sm text-ink-muted" aria-live="polite">
              {dictation.state === "starting"
                ? "Starting microphone…"
                : dictation.state === "listening"
                  ? dictation.interim || "Listening… speak now"
                  : text.trim()
                    ? "Tap the mic to add more, or edit below"
                    : "Tap the mic and speak, or type below"}
            </p>
            {dictation.error && <p className="text-center text-sm text-danger">{dictation.error}</p>}
          </div>
        )}

        <label className="block">
          <span className="sr-only">Note</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            rows={4}
            placeholder={`e.g. ${first}'s footwork was much better today. Keep practising the front-foot drive.`}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          />
          <span className="mt-1 block text-right text-xs text-ink-subtle">{text.length}/{MAX}</span>
        </label>

        <button
          type="button"
          onClick={save}
          disabled={pending || text.trim() === saved.trim()}
          className="brand-bg w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {!text.trim() && saved.trim() ? "Remove note" : "Save note"}
        </button>
        <p className="text-xs leading-relaxed text-ink-subtle">
          {dictation.supported
            ? "Your phone turns speech into text. TRIQ keeps only the text you save, never the recording. If the mic here doesn't work, tap the box and use the mic key on your keyboard."
            : "Speaking isn't available in this browser. Tap the box and use the mic key on your keyboard, or open TRIQ in Chrome."}
        </p>
      </div>
    </BottomSheet>
  );
}
