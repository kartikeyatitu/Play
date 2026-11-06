// TRIQ Connect profile metadata stored in existing columns only. Pure and client-safe.
//
// ProfessionalProfile has no columns for professional type, specialisations, languages or delivery mode,
// and schema changes are out of scope. They are kept as one readable, versioned line at the end of
// ProfessionalProfile.bio:
//
//   [TRIQ Connect] type=PHYSIOTHERAPIST; modes=ONLINE|IN_PERSON; languages=English|Hindi; specialisations=Return to sport
//
// Every value is checked against the fixed lists in ./types on the way out, so a hand-edited line can
// never inject an unknown type. A missing or broken line means "not a Connect professional" (unlisted).
// TODO(schema): move these into real columns when the Connect schema lands.

import {
  isDeliveryMode,
  isLanguage,
  isProType,
  isSpecialisationFor,
  type DeliveryMode,
  type ProType,
} from "./types";

export const META_PREFIX = "[TRIQ Connect] ";
export const MAX_USER_BIO = 1500;

export interface ProMeta {
  type: ProType;
  modes: DeliveryMode[];
  languages: string[];
  specialisations: string[];
}

const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));

export function encodeMetaLine(m: ProMeta): string {
  const clean = (xs: string[]) => xs.map((x) => x.replace(/[|;=\n\r]/g, " ").trim()).filter(Boolean).join("|");
  return `${META_PREFIX}type=${m.type}; modes=${clean(m.modes)}; languages=${clean(m.languages)}; specialisations=${clean(m.specialisations)}`;
}

/** Splits a stored bio into the professional's own text and the parsed Connect metadata (or null). */
export function splitBio(stored: string | null | undefined): { bio: string; meta: ProMeta | null } {
  const text = stored ?? "";
  const lines = text.split(/\r?\n/);
  let idx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith(META_PREFIX)) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return { bio: text.trim(), meta: null };
  const bio = lines.filter((_, i) => i !== idx).join("\n").trim();
  return { bio, meta: parseMetaLine(lines[idx]) };
}

export function parseMetaLine(line: string): ProMeta | null {
  if (!line.startsWith(META_PREFIX)) return null;
  const fields: Record<string, string> = {};
  for (const part of line.slice(META_PREFIX.length).split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  const type = fields.type;
  if (!isProType(type)) return null;
  const list = (v: string | undefined) => (v ? v.split("|").map((s) => s.trim()).filter(Boolean) : []);
  const modes = uniq(list(fields.modes).filter(isDeliveryMode));
  if (modes.length === 0) return null;
  return {
    type,
    modes,
    languages: uniq(list(fields.languages).filter(isLanguage)),
    specialisations: uniq(list(fields.specialisations).filter((s) => isSpecialisationFor(type, s))),
  };
}

/** Builds the stored bio: the professional's own text, a blank line, then the metadata line. */
export function joinBio(bio: string, meta: ProMeta): string {
  const own = bio
    .split(/\r?\n/)
    .filter((l) => !l.startsWith(META_PREFIX))
    .join("\n")
    .trim()
    .slice(0, MAX_USER_BIO);
  return own ? `${own}\n\n${encodeMetaLine(meta)}` : encodeMetaLine(meta);
}
