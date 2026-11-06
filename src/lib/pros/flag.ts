// TRIQ Connect professional pages are off unless NEXT_PUBLIC_PROS === "1" (not in features.ts on purpose).
export function prosEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PROS === "1";
}
