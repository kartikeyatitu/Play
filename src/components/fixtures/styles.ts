// Shared classes and formatters for the fixtures screens (semantic theme tokens only).

export const card = "rounded-2xl border border-line bg-surface p-4";
export const inputCls =
  "h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-volt focus:outline-none";
export const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-subtle";
const btn = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50";
export const primaryBtn = `${btn} bg-volt text-volt-fg hover:opacity-90`;
export const ghostBtn = `${btn} border border-line text-ink hover:bg-surface-2`;
export const dangerText = "text-sm text-danger";

export const fmtIst = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : null;

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Registration open",
  SCHEDULED: "In progress",
  COMPLETED: "Completed",
};

export const MODE_LABEL: Record<string, string> = {
  ROUND_ROBIN: "League (round robin)",
  KNOCKOUT: "Knockout",
  GROUPS: "Groups + knockout",
};
