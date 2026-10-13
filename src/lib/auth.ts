import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "crypto";

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

const SESSION_SECRET = getSessionSecret();

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
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySignedCookie(cookie: string): any | null {
  try {
    const lastDotIndex = cookie.lastIndexOf(".");
    if (lastDotIndex === -1) return null;
    const payload = cookie.substring(0, lastDotIndex);
    const signature = cookie.substring(lastDotIndex + 1);
    
    if (!payload || !signature) return null;
    
    const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
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
  const session = await getSession();
  if (!session) redirect("/login");
  
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    // Redirect to appropriate dashboard based on role
    if (session.role === "ADMIN") redirect("/org");
    if (session.role === "COACH") redirect("/coach");
    if (session.role === "PARENT") redirect("/parent");
    redirect("/login");
  }

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
  if (role === "PARENT") return "/parent";
  return "/login";
}
