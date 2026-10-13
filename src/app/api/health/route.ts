import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health + keep-warm endpoint. An uptime pinger (e.g. UptimeRobot, every 5 min) calls this so the
 * Mumbai function and its Postgres connection stay warm, avoiding ~5 s cold starts for real users.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up", ms: Date.now() - started }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
