// Simple in-memory rate limiter for serverless
// Resets on cold start — good enough for MVP, use Redis/Upstash for production scale

const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxAttempts: number = 5, windowMs: number = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxAttempts - entry.count };
}

// Cleanup old entries every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now > entry.resetAt) attempts.delete(key);
    }
  }, 5 * 60_000);
}

/**
 * Persistent (Postgres-backed) fixed-window limiter for abuse-sensitive endpoints (OTP, login).
 * One atomic upsert per call, so it holds across serverless instances and cold starts.
 * If the database is unreachable it falls back to the in-memory limiter rather than locking everyone out.
 */
export async function rateLimitDb(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const { db } = await import("@/lib/db");
    const resetAt = new Date(Date.now() + windowMs);
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt", "updatedAt")
      VALUES (${key}, 1, ${resetAt}, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN ${resetAt} ELSE "RateLimit"."resetAt" END,
        "updatedAt" = NOW()
      RETURNING "count"`;
    const count = Number(rows?.[0]?.count ?? 1);
    return { allowed: count <= maxAttempts, remaining: Math.max(0, maxAttempts - count) };
  } catch (e) {
    console.error("rateLimitDb failed, using in-memory fallback:", e);
    return rateLimit(key, maxAttempts, windowMs);
  }
}
