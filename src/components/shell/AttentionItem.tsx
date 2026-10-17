import type { CSSProperties, ReactNode } from "react";
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
  className = "",
  style,
}: {
  title: ReactNode;
  detail?: ReactNode;
  tone?: AttentionTone;
  onClick?: () => void;
  href?: string;
  trailing?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const cls =
    `press group w-full min-h-[52px] flex items-center gap-3 rounded-xl border border-line/80 bg-surface/40 px-3.5 py-2.5 text-left hover:bg-surface hover:border-zinc-700 ${className}`;
  const inner = (
    <>
      <span className={`h-2 w-2 rounded-full shrink-0 ${DOT[tone]}`} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-zinc-100 truncate">{title}</span>
        {detail != null && <span className="block text-xs text-ink-subtle truncate tabular-nums">{detail}</span>}
      </span>
      {trailing ?? <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
  if (href) return <a href={href} className={cls} style={style}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls} style={style}>{inner}</button>;
}
