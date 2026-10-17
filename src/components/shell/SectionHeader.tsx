import type { ReactNode } from "react";

/** Section title used across the owner dashboard (Today, People, Fees…), set in the athletic heading face. */
export function SectionHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 mb-3 sm:mb-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="font-heading text-[19px] sm:text-xl font-bold leading-tight text-ink">{title}</h2>
        {description && <p className="text-xs sm:text-sm text-ink-subtle mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap sm:shrink-0">{actions}</div>}
    </div>
  );
}
