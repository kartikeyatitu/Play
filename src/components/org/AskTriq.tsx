"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { askTriq } from "@/app/actions/ask";
import { getAiStatus } from "@/app/actions/ai";
import { ASK_EXAMPLES, type AskAnswer } from "@/lib/ask";

type State = { kind: "idle" } | { kind: "answer"; answer: AskAnswer } | { kind: "unsupported"; examples: string[] } | { kind: "error"; message: string };

export function AskTriq() {
  const [available, setAvailable] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    getAiStatus("reports.view")
      .then((r) => setAvailable(r.available))
      .catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  async function ask(q: string) {
    const text = q.trim();
    if (!text || asking) return;
    setQuestion(text);
    setAsking(true);
    try {
      const res = await askTriq(text);
      if (!res.success) setState({ kind: "error", message: res.error });
      else if ("unsupported" in res) setState({ kind: "unsupported", examples: res.examples });
      else setState({ kind: "answer", answer: res.answer });
    } catch {
      setState({ kind: "error", message: "Couldn't answer that. Please try again." });
    } finally {
      setAsking(false);
    }
  }

  return <AskTriqView question={question} setQuestion={setQuestion} asking={asking} state={state} onAsk={ask} />;
}

export function AskTriqView({
  question,
  setQuestion,
  asking,
  state,
  onAsk,
}: {
  question: string;
  setQuestion: (q: string) => void;
  asking: boolean;
  state: State;
  onAsk: (q: string) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 space-y-3" aria-labelledby="ask-triq-title">
      <h3 id="ask-triq-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Sparkles className="w-4 h-4 text-volt" aria-hidden /> Ask TRIQ
      </h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(question);
        }}
        className="flex gap-2"
      >
        <label htmlFor="ask-triq-input" className="sr-only">Ask a question about your academy</label>
        <input
          id="ask-triq-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="e.g. Which batch has the most unpaid fees?"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-volt"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={asking || question.trim().length < 3}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-volt text-volt-fg text-sm font-semibold hover:bg-volt/90 disabled:opacity-50"
        >
          {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="hidden sm:inline">{asking ? "Finding…" : "Ask"}</span>
        </button>
      </form>

      {state.kind === "idle" && (
        <div className="flex flex-wrap gap-2">
          {ASK_EXAMPLES.slice(0, 4).map((ex) => (
            <button key={ex} type="button" onClick={() => onAsk(ex)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted hover:text-ink hover:bg-surface-2">
              {ex}
            </button>
          ))}
        </div>
      )}

      {state.kind === "error" && <p className="text-sm text-danger">{state.message}</p>}

      {state.kind === "unsupported" && (
        <div className="space-y-2 text-sm text-ink-muted">
          <p>I can answer questions about fees, attendance, batches, enquiries and retention. Try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {state.examples.map((ex) => (
              <button key={ex} type="button" onClick={() => onAsk(ex)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted hover:text-ink hover:bg-surface-2">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.kind === "answer" && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink">{state.answer.title}</p>
            <p className="text-sm text-ink-muted">{state.answer.summary}</p>
          </div>
          {state.answer.rows.length > 0 && (
            <div className="rounded-lg border border-line overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-ink-subtle">
                  <tr className="border-b border-line">
                    {state.answer.columns.map((c, i) => (
                      <th key={i} className={`p-2.5 whitespace-nowrap ${state.answer.numeric.includes(i) ? "text-right" : "text-left"}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.answer.rows.map((r, ri) => (
                    <tr key={ri} className="border-b border-line last:border-0">
                      {r.map((cell, ci) => (
                        <td key={ci} className={`p-2.5 ${state.answer.numeric.includes(ci) ? "text-right tabular-nums whitespace-nowrap" : "text-ink"}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {state.answer.note && <p className="text-xs text-ink-subtle">{state.answer.note}</p>}
          <p className="text-xs text-ink-subtle">AI chose which report answers your question. The numbers come straight from your records.</p>
        </div>
      )}
    </section>
  );
}
