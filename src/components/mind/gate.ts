import { notFound } from "next/navigation";
import { isMindC1Enabled } from "@/lib/mind/flag";

/** Call at the top of every /mind page. Returns a 404 while the C1 flag is off. */
export function requireMindC1(): void {
  if (!isMindC1Enabled()) notFound();
}
