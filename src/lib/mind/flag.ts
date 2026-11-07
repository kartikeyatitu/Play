// Feature gate for TRIQ Mind & Performance release C1 (content only).
// ON by default (founder decision D-14, 2026-11-07). Set NEXT_PUBLIC_MIND_C1="0" to switch it off.
export function isMindC1Enabled(value: string | undefined = process.env.NEXT_PUBLIC_MIND_C1): boolean {
  return value !== "0" && value !== "false";
}
