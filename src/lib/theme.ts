/** Colour themes (palettes live in src/app/themes.css). Stored per browser in localStorage only. */

export const THEMES = [
  {
    id: "light",
    name: "Light",
    description: "Off-white and ink with an orange accent. Easy to read outdoors.",
    swatch: ["#f7f7f5", "#ffffff", "#d1440a"],
  },
  {
    id: "dark",
    name: "Dark",
    description: "Graphite surfaces for evenings and low light.",
    swatch: ["#0e1116", "#151a21", "#f26b2a"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "light";
export const THEME_STORAGE_KEY = "triq_theme";

/** Earlier builds offered five palettes; map whatever a device saved onto Light or Dark. */
const LEGACY: Record<string, ThemeId> = {
  night: "dark",
  indigo: "dark",
  stadium: "dark",
  daylight: "light",
  arena: "light",
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && THEMES.some((t) => t.id === v);
}

export function normalizeTheme(v: unknown): ThemeId {
  if (isThemeId(v)) return v;
  if (typeof v === "string" && v in LEGACY) return LEGACY[v];
  return DEFAULT_THEME;
}

export function getStoredTheme(): ThemeId {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Apply immediately (no reload) and remember it on this device. */
export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  root.setAttribute("data-theme", id);
  const color = getComputedStyle(root).getPropertyValue("--theme-color").trim();
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode: the theme still applies for this visit */
  }
  window.dispatchEvent(new CustomEvent("triq:theme", { detail: id }));
}

/**
 * Inline <head> script: sets data-theme before first paint so there is no flash of the
 * wrong palette. Legacy values (night, daylight, …) are rewritten to light/dark.
 * Kept tiny and dependency-free.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}",t=localStorage.getItem(k),m=${JSON.stringify(LEGACY)};if(t&&m[t]){t=m[t];localStorage.setItem(k,t);}if(t!=="light"&&t!=="dark")t="${DEFAULT_THEME}";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

/** Reads a themed RGB triplet variable (e.g. "--n-800") as a CSS colour string. */
export function cssVarColor(name: string, alpha = 1, el?: Element | null): string {
  if (typeof window === "undefined") return "transparent";
  const v = getComputedStyle(el ?? document.documentElement).getPropertyValue(name).trim();
  if (!v) return "transparent";
  return alpha === 1 ? `rgb(${v.split(/\s+/).join(",")})` : `rgba(${v.split(/\s+/).join(",")},${alpha})`;
}
