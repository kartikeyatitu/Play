// Detects "table/column does not exist" errors so flag-gated features fail politely when their
// additive SQL (prisma/sql/*.sql) has not been applied yet. Pure and client-safe.

export function isMissingTableError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "P2021" || err.code === "P2022") return true; // Prisma: table / column does not exist
  return typeof err.message === "string" && /(relation|table|column) .* does not exist/i.test(err.message);
}

export const SCHEMA_PENDING_MESSAGE = "This feature is not set up yet (database update pending).";
