// Display names for fixtures, tables and brackets. Pure, client-safe.

/**
 * Team entries show the team name. Individual entries (children, mostly) show first name plus last
 * initial, never the full name: "Aarav Sharma" → "Aarav S.". A uniqueness suffix added at
 * registration, like "(2)", is kept so two players with the same name stay distinguishable.
 */
export function entryDisplayName(name: string, entryType: string): string {
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (entryType !== "INDIVIDUAL") return clean;
  const m = clean.match(/^(.*?)(\s*\(\d+\))?$/);
  const base = (m?.[1] ?? clean).trim();
  const suffix = m?.[2]?.trim() ?? "";
  const parts = base.split(" ").filter(Boolean);
  const short = parts.length <= 1 ? (parts[0] ?? "") : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
  return suffix ? `${short} ${suffix}` : short;
}
