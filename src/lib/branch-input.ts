/** Pure validation for branch (academy location) input. No Prisma import, so it is unit-testable. */
export type BranchInput = { name: string; address: string | null; city: string | null };

/** Most branches one academy may have. */
export const MAX_BRANCHES = 50;
/** Returned by every branch action while FEATURES.branches is off. */
export const BRANCHES_DISABLED_ERROR = "Branches are not enabled for this academy yet.";

const MAX_NAME = 80;
const MAX_ADDRESS = 240;
const MAX_CITY = 80;

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

export function parseBranchInput(raw: {
  name?: unknown;
  address?: unknown;
  city?: unknown;
}): { ok: true; data: BranchInput } | { ok: false; error: string } {
  const name = clean(raw.name);
  const address = clean(raw.address);
  const city = clean(raw.city);
  if (name.length < 2) return { ok: false, error: "Branch name must be at least 2 characters." };
  if (name.length > MAX_NAME) return { ok: false, error: `Branch name must be under ${MAX_NAME} characters.` };
  if (address.length > MAX_ADDRESS) return { ok: false, error: `Address must be under ${MAX_ADDRESS} characters.` };
  if (city.length > MAX_CITY) return { ok: false, error: `City must be under ${MAX_CITY} characters.` };
  return { ok: true, data: { name, address: address || null, city: city || null } };
}
