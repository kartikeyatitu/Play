// Pure helpers for the public receipt page (no DB / server-only imports).

/**
 * Reduce a child's full name to "First L." for public display.
 * "Aarav Kumar Sharma" -> "Aarav S." ; "Aarav" -> "Aarav" ; "" -> "Student".
 * Never returns more than the first name and the last initial.
 */
export function maskStudentName(fullName: string | null | undefined): string {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Student";
  const first = parts[0];
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1];
  const initial = Array.from(last)[0]?.toUpperCase() ?? "";
  return initial ? `${first} ${initial}.` : first;
}
