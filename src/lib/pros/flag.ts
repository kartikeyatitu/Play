// TRIQ Connect professional pages. ON by default (founder decision D-14, 2026-11-07).
// Set NEXT_PUBLIC_PROS="0" to switch them off.
export function prosEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_PROS;
  return v !== "0" && v !== "false";
}
