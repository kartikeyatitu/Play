// Feature gate for TRIQ Mind & Performance release C1 (content only).
// Deliberately separate from src/lib/features.ts. Off unless NEXT_PUBLIC_MIND_C1 is exactly "1".
export function isMindC1Enabled(value: string | undefined = process.env.NEXT_PUBLIC_MIND_C1): boolean {
  return value === "1";
}
