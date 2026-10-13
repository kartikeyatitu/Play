import type { ReactNode } from "react";

/** Quiet section title used across the owner dashboard (Today, People, Fees…). */
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
    <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 sm:mb-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] sm:text-base font-semibold text-zinc-100 tracking-tight">{title}</h2>
        {description && <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap sm:shrink-0">{actions}</div>}
    </div>
  );
}
