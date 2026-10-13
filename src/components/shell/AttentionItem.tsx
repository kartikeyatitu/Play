import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type AttentionTone = "danger" | "warn" | "info";

const DOT: Record<AttentionTone, string> = {
  danger: "bg-rose-400",
  warn: "bg-amber-400",
  info: "bg-sky-400",
};

/** One tappable row in a "Needs attention" list. */
export function AttentionItem({
  title,
  detail,
  tone = "warn",
  onClick,
  href,
  trailing,
}: {
  title: ReactNode;
  detail?: ReactNode;
  tone?: AttentionTone;
  onClick?: () => void;
  href?: string;
  trailing?: ReactNode;
}) {
  const cls =
    "w-full min-h-[52px] flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 text-left hover:bg-zinc-900 hover:border-zinc-700 transition-colors";
  const inner = (
    <>
      <span className={`h-2 w-2 rounded-full shrink-0 ${DOT[tone]}`} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-zinc-100 truncate">{title}</span>
        {detail != null && <span className="block text-xs text-zinc-500 truncate tabular-nums">{detail}</span>}
      </span>
      {trailing ?? <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" aria-hidden />}
    </>
  );
  if (href) return <a href={href} className={cls}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}
