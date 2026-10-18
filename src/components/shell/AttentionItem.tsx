import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type AttentionTone = "danger" | "warn" | "info";

const DOT: Record<AttentionTone, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-sky-400",
};

/**
 * One tappable row in a "Needs attention" list. Rows sit inside a shared card
 * (divide-y), so the row itself has no border: a status dot, a title, a detail line.
 */
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
  const cls = `group w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2 ${className}`;
  const inner = (
    <>
      <span className={`h-2 w-2 rounded-full shrink-0 ${DOT[tone]}`} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-ink truncate">{title}</span>
        {detail != null && <span className="block text-[13px] text-ink-subtle truncate tabular-nums mt-0.5">{detail}</span>}
      </span>
      {trailing ?? <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" aria-hidden />}
    </>
  );
  if (href) return <a href={href} className={cls} style={style}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls} style={style}>{inner}</button>;
}
