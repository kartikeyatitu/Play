import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "crypto";
import { HAT_APP_ROLE, HAT_HOME, hatForAppRole, isHat, type Hat } from "@/lib/roles/hats";

// SESSION_SECRET is preferred; HMAC_SECRET is the secret actually configured on Vercel.
// Never fall back to the public dev string in production (it would make cookies forgeable).
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.HMAC_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: SESSION_SECRET or HMAC_SECRET must be configured in production");
  }
  return "dev-only-secret-do-not-use-in-prod";
}

// Resolved on first use, not at module load: `next build` imports this file while collecting
// page data, and builds (e.g. Preview) may not have the secret. Requests still fail closed.
let cachedSecret: string | null = null;
function sessionSecret(): string {
  if (!cachedSecret) cachedSecret = getSessionSecret();
  return cachedSecret;
}

/** Cookie options shared by every place that sets the session cookie. */
export const SESSION_COOKIE_NAME = "sportsos_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export function createSignedCookie(data: any): string {
  const payload = JSON.stringify(data);
  const signature = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySignedCookie(cookie: string): any | null {
  try {
    const lastDotIndex = cookie.lastIndexOf(".");
    if (lastDotIndex === -1) return null;
    const payload = cookie.substring(0, lastDotIndex);
    const signature = cookie.substring(lastDotIndex + 1);
    
    if (!payload || !signature) return null;
    
    const expectedSignature = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

export async function requireAuth(allowedRoles?: string[]) {
  let session = await getSession();
  if (!session) redirect("/login");
  
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    // "Viewing as": a second hat the person really holds (re-checked against the database) may open
    // this page, acting as that hat's role. Nothing is read from the DB unless the signed claim exists.
    const activeHat = await getActiveHat(session);
    if (activeHat && allowedRoles.includes(HAT_APP_ROLE[activeHat])) {
      session = { ...session, role: HAT_APP_ROLE[activeHat] };
    } else {
      if (activeHat) redirect(HAT_HOME[activeHat]);
      redirectToRoleHome(session.role);
    }
  }


  // Make sure tables added after launch exist (no-op once created)
  const { ensureTeamSchema } = await import("@/lib/schema-ensure");
  await ensureTeamSchema();

  // Fetch live user and organization data from DB
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { 
      name: true,
      email: true,
      orgId: true, 
      lastSeenAt: true,
      org: { select: { id: true, name: true, slug: true } } 
    }
  });

  // Best-effort "last seen" (powers the coach's "parents who haven't joined" card).
  // Throttled to one write per 6h per user; never blocks or breaks the request.
  if (user && (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 6 * 60 * 60 * 1000)) {
    db.user.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  return {
    ...session,
    name: user?.name || session.name,
    email: user?.email || session.email,
    orgId: user?.orgId || user?.org?.id || null,
    orgName: user?.org?.name || null,
    orgSlug: user?.org?.slug || null,
  };
}

/** Redirects to the dashboard for a User.role (unchanged pre-"viewing as" behaviour). */
function redirectToRoleHome(role: string): never {
  if (role === "ADMIN") redirect("/org");
  if (role === "COACH") redirect("/coach");
  if (role === "STAFF") redirect("/staff");
  if (role === "PARENT") redirect("/parent");
  redirect("/login");
}

/** Per-request cached lookup of the fields that decide whether a session cookie is still valid. */
const loadSessionUser = cache(async (id: string) => {
  const { db } = await import("@/lib/db");
  return db.user.findUnique({ where: { id }, select: { role: true, sessionVersion: true } });
});

/**
 * Returns the signed-in session or null. Beyond checking the cookie signature this verifies the user
 * still exists and that the cookie's session version matches (so "sign out everywhere" and account
 * removal take effect immediately). The role always comes from the database, never the cookie.
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  const data = verifySignedCookie(sessionCookie);
  if (!data?.id) return null;

  const live = await loadSessionUser(String(data.id));
  if (!live) return null;
  // Cookies minted before session versioning have no `sv`; treat as version 0.
  if ((data.sv ?? 0) !== live.sessionVersion) return null;
  return { ...data, role: live.role };
}

/** Sets the signed session cookie. Only callable from server actions / route handlers. */
export async function setSessionCookie(id: string, role: string) {
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({ where: { id }, select: { sessionVersion: true } });
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    createSignedCookie({ id, role, sv: user?.sessionVersion ?? 0 }),
    SESSION_COOKIE_OPTIONS
  );
}

/** Revokes every existing session cookie for a user (all devices). */
export async function revokeAllSessions(userId: string) {
  const { db } = await import("@/lib/db");
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}


/** Where a user should land after signing in. */
export function homePathForRole(role: string, hasOrg: boolean) {
  if (role === "ADMIN") return hasOrg ? "/org" : "/onboarding";
  if (role === "COACH") return "/coach";
  if (role === "STAFF") return "/staff";
  if (role === "PARENT") return "/parent";
  return "/login";
}


// ───── "Viewing as" (multi-role) ─────
// The active hat lives in its own signed cookie, separate from the session cookie, so existing sessions
// are untouched and nobody is logged out. The claim is bound to the user id and session version
// ("sign out everywhere" kills it too) and is only a *request*: every read re-derives the person's hats
// from the database and ignores a hat they no longer hold. No claim = default hat from User.role.

export const ACTIVE_ROLE_COOKIE_NAME = "triq_active_role";

/** The verified signed claim's hat (not yet checked against the DB), or null. */
async function readActiveHatClaim(session: { id: string; sv?: number }): Promise<Hat | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_ROLE_COOKIE_NAME)?.value;
  if (!raw) return null;
  const data = verifySignedCookie(raw);
  if (!data || String(data.id) !== String(session.id)) return null;
  if ((data.sv ?? 0) !== (session.sv ?? 0)) return null;
  return isHat(data.hat) ? data.hat : null;
}

/** Per-request cached DB recompute of a person's hats. */
const loadHatsCached = cache(async (userId: string) => {
  const { loadHeldHats } = await import("@/lib/roles/server");
  return loadHeldHats(userId);
});

/**
 * The hat this person chose to view as, if it differs from their default (User.role) hat and they still
 * hold it according to the database. Null means "default hat": single-role users always get null and
 * cost no extra query.
 */
export async function getActiveHat(session: { id: string; role: string; sv?: number }): Promise<Hat | null> {
  const claimed = await readActiveHatClaim(session);
  if (!claimed || claimed === hatForAppRole(session.role)) return null;
  const held = await loadHatsCached(String(session.id));
  return held && held.hats.includes(claimed) ? claimed : null;
}

/**
 * Sets (or with null clears) the signed active-hat cookie. Callers must have verified the hat against
 * loadHeldHats first; only callable from server actions / route handlers.
 */
export async function setActiveHatCookie(session: { id: string; sv?: number }, hat: Hat | null) {
  const cookieStore = await cookies();
  if (!hat) {
    cookieStore.delete(ACTIVE_ROLE_COOKIE_NAME);
    return;
  }
  cookieStore.set(
    ACTIVE_ROLE_COOKIE_NAME,
    createSignedCookie({ id: session.id, hat, sv: session.sv ?? 0 }),
    SESSION_COOKIE_OPTIONS
  );
}
