// Pure helpers for roster imports (kept out of "use server" files, which may only export async functions).

/** Parse the many ways a DOB shows up in school/academy spreadsheets. Returns null if unusable. */
export function parseDob(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;

  let d: Date | null = null;

  // Excel serial date (e.g. 44927). XLSX gives these when a date cell isn't formatted as text.
  if (/^\d{4,6}(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 3000 && serial < 80000) {
      d = new Date(Math.round((serial - 25569) * 86400 * 1000)); // 25569 = days from 1899-12-30 to 1970-01-01
    }
  }

  // yyyy-mm-dd or yyyy/mm/dd
  if (!d) {
    const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  }

  // dd-mm-yyyy / dd/mm/yyyy / dd.mm.yy (Indian convention: day first)
  if (!d) {
    const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (dmy) {
      let year = +dmy[3];
      if (dmy[3].length === 2) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
      d = new Date(Date.UTC(year, +dmy[2] - 1, +dmy[1]));
    }
  }

  // Last resort: let JS try ("12 Mar 2014", etc.)
  if (!d) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }

  if (!d || Number.isNaN(d.getTime())) return null;

  // Sanity: a student is between 2 and 70 years old.
  const now = Date.now();
  const age = (now - d.getTime()) / (365.25 * 86400 * 1000);
  if (age < 2 || age > 70) return null;
  return d;
}

/** Normalise a phone number: strips non-digits, returns digits if valid length (7-15). */
export function cleanPhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

/** @deprecated Use cleanPhone instead. */
export const cleanIndianPhone = cleanPhone;
