/**
 * Removes contact details from free text before it is sent to an AI provider.
 * Coaches type their own points, which can include a parent's number or email by accident.
 */
export function redactContactDetails(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email removed]")
    .replace(/(?:\+?\d[\d\s-]{8,}\d)/g, (m) => (m.replace(/\D/g, "").length >= 10 ? "[number removed]" : m));
}

const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const YEAR = "(?:19|20)\\d{2}";
const DAY = "\\d{1,2}(?:st|nd|rd|th)?";

const DATE_PATTERNS: RegExp[] = [
  // 2015-03-12, 2015/3/12
  new RegExp(`\\b${YEAR}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\\d|3[01])\\b`, "g"),
  // 12/03/2015, 12-3-2015, 12.03.2015
  new RegExp(`\\b(?:0?[1-9]|[12]\\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.]${YEAR}\\b`, "g"),
  // 12 March 2015, 12th Mar. 2015
  new RegExp(`\\b${DAY}\\s+(?:${MONTH})\\.?,?\\s+${YEAR}\\b`, "gi"),
  // March 12, 2015, Mar 12th 2015
  new RegExp(`\\b(?:${MONTH})\\.?\\s+${DAY},?\\s+${YEAR}\\b`, "gi"),
];

/** Dates with a day in them, which can be a date of birth. "March 2026" (month only) is kept. */
export function redactDatesOfBirth(text: string): string {
  let out = text;
  for (const re of DATE_PATTERNS) out = out.replace(re, "[date removed]");
  // "DOB: 12/03/15" and "born 3-5-10": a short year is only a date when a birth keyword comes before it.
  return out.replace(
    /\b(dob|d\.o\.b\.?|date of birth|born|birthday)(\W{0,3}\s*)\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/gi,
    "$1$2[date removed]",
  );
}
