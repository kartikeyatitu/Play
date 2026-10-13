import React from "react";

export function EmptyState({ icon, title, description }: { icon?: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon || "📭"}</span>
      <h3 className="text-lg font-semibold text-zinc-400">{title}</h3>
      {description && <p className="text-sm text-zinc-600 mt-1 max-w-xs">{description}</p>}
    </div>
  );
}
