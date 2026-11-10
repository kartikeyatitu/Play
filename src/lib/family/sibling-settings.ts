// Academy sibling-discount setting. Pure. Stored as the latest AuditLog row with this action (no new
// table), so turning it on needs no database change. Off by default; the academy picks the percentages.

export const SIBLING_SETTINGS_ACTION = "SIBLING_DISCOUNT_SETTINGS";
export const SIBLING_DISCOUNT_ACTION = "FEE_SIBLING_DISCOUNT";

export type SiblingSettings = { enabled: boolean; secondChildPercent: number; thirdPlusPercent: number };
export const SIBLING_DEFAULT: SiblingSettings = { enabled: false, secondChildPercent: 0, thirdPlusPercent: 0 };

const pct = (v: unknown): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 50) return null;
  return Math.round(n * 10) / 10;
};

export function parseSiblingSettings(raw: unknown): SiblingSettings {
  let o: Record<string, unknown> = {};
  try {
    o = typeof raw === "string" ? JSON.parse(raw) : raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  } catch {
    return SIBLING_DEFAULT;
  }
  const second = pct(o.secondChildPercent) ?? 0;
  const third = pct(o.thirdPlusPercent) ?? second;
  return { enabled: o.enabled === true && (second > 0 || third > 0), secondChildPercent: second, thirdPlusPercent: third };
}

/** Owner input → settings, or an error to show. Discounts are capped at 50% (a scholarship is the tool for more). */
export function validateSiblingSettings(input: { enabled?: unknown; secondChildPercent?: unknown; thirdPlusPercent?: unknown }):
  | { ok: true; settings: SiblingSettings }
  | { ok: false; error: string } {
  const enabled = input.enabled === true;
  const second = pct(input.secondChildPercent ?? 0);
  const third = pct(input.thirdPlusPercent ?? input.secondChildPercent ?? 0);
  if (second === null || third === null) return { ok: false, error: "Enter a percentage from 0 to 50. For more, use a scholarship." };
  if (enabled && second === 0 && third === 0) return { ok: false, error: "Set a percentage above 0 to turn the discount on." };
  return { ok: true, settings: { enabled, secondChildPercent: second, thirdPlusPercent: third } };
}

/**
 * Families: children who share a guardian (primary parent or a linked guardian) end up in one group.
 * Union-find, so a child linked to two guardians joins both guardians' children together.
 */
export function groupFamilies(
  students: readonly { id: string; parentId: string | null }[],
  links: readonly { userId: string; studentId: string }[] = [],
): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const ids = new Set(students.map((s) => s.id));
  for (const s of students) parent.set(s.id, s.id);
  const firstChildOf = new Map<string, string>();
  const join = (guardian: string | null, child: string) => {
    if (!guardian || !ids.has(child)) return;
    const first = firstChildOf.get(guardian);
    if (first) union(first, child);
    else firstChildOf.set(guardian, child);
  };
  for (const s of students) join(s.parentId, s.id);
  for (const l of links) join(l.userId, l.studentId);
  const groups = new Map<string, string[]>();
  for (const s of students) {
    const r = find(s.id);
    groups.set(r, [...(groups.get(r) ?? []), s.id]);
  }
  return [...groups.values()];
}
