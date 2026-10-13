"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { getMyAcademies, switchAcademy } from "@/app/actions/team";
import { roleLabel } from "@/lib/team";

type Academy = Awaited<ReturnType<typeof getMyAcademies>>[number];

/** Shown only to people who work at more than one academy (e.g. a coach at two academies). */
export function AcademySwitcher({ className = "" }: { className?: string }) {
  const [academies, setAcademies] = React.useState<Academy[]>([]);
  const [switching, setSwitching] = React.useState(false);

  React.useEffect(() => {
    getMyAcademies().then(setAcademies).catch(() => setAcademies([]));
  }, []);

  if (academies.length < 2) return null;
  const active = academies.find((a) => a.active);

  return (
    <label className={`inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 h-11 text-sm ${className}`}>
      <ArrowLeftRight className="w-4 h-4 text-lime-300 shrink-0" aria-hidden />
      <span className="sr-only">Switch academy</span>
      <select
        value={active?.orgId}
        disabled={switching}
        onChange={async (e) => {
          setSwitching(true);
          try {
            const res = await switchAcademy(e.target.value);
            window.location.href = res.redirectTo;
          } catch (err: any) {
            toast.error(err?.message || "Couldn't switch academy");
            setSwitching(false);
          }
        }}
        className="bg-transparent text-white font-medium focus:outline-none max-w-[14rem] truncate"
      >
        {academies.map((a) => (
          <option key={a.orgId} value={a.orgId} className="bg-zinc-900">
            {a.name} · {roleLabel(a.role, a.staffRole)}
          </option>
        ))}
      </select>
    </label>
  );
}
