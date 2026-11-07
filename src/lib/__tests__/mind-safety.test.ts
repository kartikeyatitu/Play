import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_EXERCISES, SKILLS } from "@/lib/mind/content";
import { COACH_TOPICS, PARENT_TOPICS } from "@/lib/mind/education";
import { isMindC1Enabled } from "@/lib/mind/flag";
import { BREATHING_PATTERNS, REFLECTION_PROMPTS, RESET_CARDS } from "@/lib/mind/match-day";
import { SPORT_PACKS } from "@/lib/mind/sport-packs";
import { CONTACTS_PENDING_NOTE, SAFETY_NOTE, SUPPORT_PATH, SUPPORT_REGIONS } from "@/lib/mind/support";

const ROOT = path.resolve(__dirname, "../../..");
const MIND_DIRS = ["src/lib/mind", "src/components/mind", "src/app/mind"].map((d) => path.join(ROOT, d));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}
const SOURCES = MIND_DIRS.flatMap(walk).map((file) => ({ file: path.relative(ROOT, file), text: readFileSync(file, "utf8") }));

describe("mind C1 flag", () => {
  it("is on by default and off only when explicitly switched off (decision D-14)", () => {
    for (const v of [undefined, "", "1", "true", "on"]) expect(isMindC1Enabled(v)).toBe(true);
    for (const v of ["0", "false"]) expect(isMindC1Enabled(v)).toBe(false);
  });

  it("is checked by every /mind page", () => {
    const pages = SOURCES.filter((s) => s.file.startsWith("src/app/mind") && s.file.endsWith("page.tsx"));
    expect(pages.map((p) => p.file).sort()).toEqual(
      [
        "src/app/mind/coaches/page.tsx",
        "src/app/mind/match-day/page.tsx",
        "src/app/mind/page.tsx",
        "src/app/mind/parents/page.tsx",
        "src/app/mind/skills/[skill]/page.tsx",
        "src/app/mind/sport/[sport]/page.tsx",
        "src/app/mind/support/page.tsx",
      ].map((p) => p.split("/").join(path.sep)),
    );
    for (const p of pages) {
      expect(p.text, p.file).toContain("requireMindC1()");
      expect(p.text, p.file).toContain("MindShell"); // carries the safety note and support link
    }
  });
});

describe("mind C1 holds no personal data", () => {
  const FORBIDDEN: [string, RegExp][] = [
    ["database", /@\/lib\/db|prisma|supabase/i],
    ["server actions", /["']use server["']|@\/app\/actions/],
    ["network calls", /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/],
    ["browser storage", /localStorage|sessionStorage|indexedDB|document\.cookie|cookies\(\)/],
    ["analytics", /analytics|posthog|@vercel\/analytics|\btrack\(|capture\(/i],
    ["AI", /@\/lib\/ai|anthropic|openai/i],
    ["auth/session", /requireAuth|getSession|@\/lib\/auth/],
    ["textarea journal", /<textarea/i],
  ];

  for (const [label, re] of FORBIDDEN) {
    it(`does not use ${label}`, () => {
      for (const s of SOURCES) {
        // Comments may mention these words to explain what is NOT done; check code only.
        const code = s.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
        expect(re.test(code), `${s.file} matches ${re}`).toBe(false);
      }
    });
  }
});

describe("mind C1 copy boundaries", () => {
  const copy = JSON.stringify({ SKILLS, SPORT_PACKS, BREATHING_PATTERNS, REFLECTION_PROMPTS, RESET_CARDS, PARENT_TOPICS, COACH_TOPICS });

  it("makes no clinical claims", () => {
    for (const re of [/\bcures?\b/i, /\btherapy\b/i, /\bheals?\b/i, /\bclinically\b/i, /\bproven\b/i, /\bguarantee/i, /\breplaces? (a|your) (doctor|psychologist|therapist)/i]) {
      expect(re.test(copy), String(re)).toBe(false);
    }
  });

  it("never asks for scores, ratings or ages", () => {
    for (const re of [/rate (yourself|your|how)/i, /out of (5|10)/i, /\bhow old\b/i, /date of birth/i, /\bscore yourself\b/i]) {
      expect(re.test(copy), String(re)).toBe(false);
    }
  });

  it("says what the content is and links to support", () => {
    expect(SAFETY_NOTE).toMatch(/mental skills training/i);
    expect(SAFETY_NOTE).toMatch(/not medical or psychological treatment/i);
    expect(SUPPORT_PATH).toBe("/mind/support");
    expect(ALL_EXERCISES.length).toBeGreaterThan(0);
  });
});

describe("mind support page", () => {
  const all = SUPPORT_REGIONS.flatMap((r) => r.contacts.map((c) => ({ ...c, region: r.id })));

  it("lists India's Tele-MANAS 14416 and the UAE emergency number 999", () => {
    expect(all.some((c) => c.region === "india" && c.number === "14416" && /tele-manas/i.test(c.name))).toBe(true);
    expect(all.some((c) => c.region === "uae" && c.number === "999")).toBe(true);
  });

  it("uses dialable numbers", () => {
    for (const c of all) expect(c.dial, c.name).toMatch(/^\d+$/);
  });

  it("is marked for clinical-advisor confirmation in code and on screen", () => {
    expect(CONTACTS_PENDING_NOTE).toMatch(/to be confirmed by the clinical advisor before launch/i);
    const page = SOURCES.find((s) => s.file.endsWith(path.join("support", "page.tsx")));
    expect(page?.text).toMatch(/CONTACTS TO BE CONFIRMED BY THE CLINICAL ADVISOR BEFORE LAUNCH/);
    expect(page?.text).toContain("CONTACTS_PENDING_NOTE");
  });
});
