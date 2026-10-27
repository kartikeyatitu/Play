/**
 * Paper register import — pure helpers. The AI reads a photo of an attendance/fee register and returns
 * JSON rows; everything here validates that reply before an admin reviews it. No I/O.
 */

export const MAX_REGISTER_ROWS = 200;

export const REGISTER_SYSTEM = [
  "You read photos of handwritten or printed sports-academy registers (student lists, attendance or fee registers).",
  "Extract one entry per student row. Copy names and numbers exactly as written; do not guess or complete missing digits.",
  'Reply with JSON only, no prose: {"rows":[{"studentName":"","parentName":"","parentPhone":"","batchName":"","feeStatus":"PAID|PENDING|","unclear":false}]}.',
  "Use an empty string for anything not written. feeStatus is PAID only if the register clearly marks the fee as paid, PENDING only if clearly unpaid, otherwise empty.",
  "Set unclear to true if any value in that row was hard to read. Ignore headings, totals, dates and signatures.",
  'If the photo is not a register, reply {"rows":[]}.',
].join(" ");

export const REGISTER_PROMPT = "Extract the student rows from this register photo as JSON.";

export type RegisterRow = {
  studentName: string;
  parentName: string;
  parentPhone: string;
  batchName: string;
  feeStatus: "PAID" | "PENDING" | "";
  /** The AI flagged this row as hard to read. */
  unclear: boolean;
};

/** 10-digit Indian mobile from messy input ("+91 98765-43210", "098765 43210"); "" if not one. */
export function normaliseMobile(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
}

function cleanText(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Pull the first JSON object or array out of a reply that may be wrapped in prose or code fences. */
export function extractJson(text: string): unknown {
  const fenced = text.replace(/```(?:json)?/gi, "");
  const start = fenced.search(/[[{]/);
  if (start < 0) return null;
  const open = fenced[start];
  const close = open === "{" ? "}" : "]";
  const end = fenced.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Validate and normalise the AI reply. Never throws; unusable replies give zero rows. */
export function parseRegisterReply(text: string): { rows: RegisterRow[]; truncated: boolean } {
  const json = extractJson(text);
  const list = Array.isArray(json) ? json : Array.isArray((json as { rows?: unknown })?.rows) ? (json as { rows: unknown[] }).rows : [];
  const rows: RegisterRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const studentName = cleanText(r.studentName, 80);
    if (studentName.length < 2) continue;
    const rawPhone = cleanText(r.parentPhone, 30);
    const phone = normaliseMobile(rawPhone);
    const fee = String(r.feeStatus ?? "").toUpperCase();
    rows.push({
      studentName,
      parentName: cleanText(r.parentName, 80),
      // Keep what was read when it isn't a valid mobile, so the admin can correct it in review.
      parentPhone: phone || rawPhone,
      batchName: cleanText(r.batchName, 60),
      feeStatus: fee === "PAID" || fee === "PENDING" ? fee : "",
      unclear: r.unclear === true || (rawPhone !== "" && phone === ""),
    });
    if (rows.length >= MAX_REGISTER_ROWS) break;
  }
  return { rows, truncated: list.length > rows.length && rows.length >= MAX_REGISTER_ROWS };
}

/** Why a reviewed row can't be imported yet, or null when it is ready. Mirrors importStudents' rules. */
export function registerRowProblem(r: Pick<RegisterRow, "studentName" | "parentName" | "parentPhone">): string | null {
  if (r.studentName.trim().length < 2) return "Add the student's name";
  if (r.parentName.trim().length < 2) return "Add the parent's name";
  if (!normaliseMobile(r.parentPhone)) return "Needs a 10-digit mobile number";
  return null;
}
