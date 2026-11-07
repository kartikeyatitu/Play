"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActiveHat, getSession, setActiveHatCookie } from "@/lib/auth";
import { HAT_HOME, SWITCH_ROLE_REFUSED, isHat } from "@/lib/roles/hats";
import { loadHeldHats } from "@/lib/roles/server";
import type { ActionResult } from "@/lib/action-result";

/**
 * "Viewing as": switch to another hat this person holds and land on its home. The hat list is
 * recomputed from the database on every call; anything not held is refused (and nothing is written).
 * Switching never widens access: each hat still goes through its normal per-membership / own-children checks.
 */
export async function switchRole(hat: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!isHat(hat)) return { ok: false, error: SWITCH_ROLE_REFUSED };
  const held = await loadHeldHats(String(session.id));
  if (!held || !held.hats.includes(hat)) return { ok: false, error: SWITCH_ROLE_REFUSED };

  const from = (await getActiveHat(session)) ?? held.defaultHat;
  await db.auditLog.create({
    data: {
      userId: session.id,
      orgId: held.orgId,
      action: "SWITCH_ROLE",
      details: JSON.stringify({ from, to: hat }),
    },
  });

  // Back to the default hat clears the claim, so the person is exactly where a single-role user is.
  await setActiveHatCookie(session, hat === held.defaultHat ? null : hat);
  redirect(HAT_HOME[hat]);
}
