/**
 * Tiny helper for user-supplied links (video highlights, gallery photos, verification documents).
 * Only absolute http(s) URLs are accepted, so a stored value can never be a `javascript:` / `data:`
 * URL that executes when another user clicks it.
 */
export function safeHttpUrl(raw: unknown, maxLength = 2048): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > maxLength) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
