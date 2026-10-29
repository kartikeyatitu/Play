/**
 * Pure redaction for text sent to an AI model. No database access here; see name-roster.ts for loading names.
 *
 * Students become "[Child n]" and parents "[Parent n]". The model only ever sees placeholders.
 * restore() maps placeholders back to names and must run on the server, on the model's reply only.
 */
import { redactContactDetails, redactDatesOfBirth } from "./redact";

export type NamedPerson = { name: string; role: "child" | "parent" };

export type NameRedaction = {
  redacted: string;
  restore: (text: string) => string;
};

/** Names shorter than this are not redacted: a one-letter name would match ordinary words. */
const MIN_NAME_LENGTH = 2;

/** Letters, combining marks and digits: a name must not sit inside a longer word. */
const WORD_CHARS = "\\p{L}\\p{M}\\p{N}";

const PLACEHOLDER_RE = /\[(?:Child|Parent) \d+\]/gi;

function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace each known name with its placeholder. Matching is case-insensitive, longest name first,
 * and only on whole words. Placeholder numbers follow alphabetical order within each role, so they
 * stay the same for the same roster regardless of input order.
 */
export function redactNames(text: string, people: NamedPerson[]): NameRedaction {
  const unique = new Map<string, NamedPerson>();
  for (const p of people) {
    const name = cleanName(p.name);
    if (name.length < MIN_NAME_LENGTH) continue;
    const key = name.toLowerCase();
    if (!unique.has(key)) unique.set(key, { name, role: p.role });
  }

  const sorted = [...unique.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const counters: Record<NamedPerson["role"], number> = { child: 0, parent: 0 };
  const placeholderFor = new Map<string, string>(); // lowercased name -> placeholder
  const nameFor = new Map<string, string>(); // lowercased placeholder -> name
  for (const [key, p] of sorted) {
    counters[p.role] += 1;
    const placeholder = `[${p.role === "child" ? "Child" : "Parent"} ${counters[p.role]}]`;
    placeholderFor.set(key, placeholder);
    nameFor.set(placeholder.toLowerCase(), p.name);
  }

  const restore = (reply: string) => reply.replace(PLACEHOLDER_RE, (m) => nameFor.get(m.toLowerCase()) ?? m);

  if (placeholderFor.size === 0) return { redacted: text, restore };

  // Longest first, so "Ravi Kumar" wins over "Ravi" at the same position.
  const keys = [...placeholderFor.keys()].sort((a, b) => b.length - a.length);
  const alternatives = keys.map((k) => k.split(" ").map(escapeRegExp).join("\\s+")).join("|");
  const pattern = new RegExp(`(?<![${WORD_CHARS}])(?:${alternatives})(?![${WORD_CHARS}])`, "giu");
  const redacted = text.replace(pattern, (match) => placeholderFor.get(cleanName(match).toLowerCase()) ?? match);

  return { redacted, restore };
}

/**
 * Everything applied to text before it reaches the model: dates of birth, phone numbers and emails
 * (existing behaviour), then names of the academy's students and parents.
 */
export function redactForModel(text: string, people: NamedPerson[]): NameRedaction {
  return redactNames(redactContactDetails(redactDatesOfBirth(text)), people);
}
