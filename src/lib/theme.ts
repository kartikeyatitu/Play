/** Colour themes (palettes live in src/app/themes.css). Stored per browser in localStorage only. */

export const THEMES = [
  {
    id: "night",
    name: "Night + Lime",
    description: "The original: near-black with a lime accent.",
    swatch: ["#09090b", "#18181b", "#a3e635"],
  },
  {
    id: "indigo",
    name: "Floodlight",
    description: "Deep indigo night match with a saffron accent.",
    swatch: ["#0b1128", "#151d3c", "#ffb020"],
  },
  {
    id: "stadium",
    name: "Stadium",
    description: "Turf green, floodlight white and trophy gold.",
    swatch: ["#091a13", "#14281f", "#e6b842"],
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "Light and warm, navy text, clay-court orange. Easy to read outdoors.",
    swatch: ["#f7f5f2", "#ffffff", "#c2410c"],
  },
  {
    id: "arena",
    name: "Arena",
    description: "Cool and light, electric blue, each sport in its own colour.",
    swatch: ["#ecf1f7", "#ffffff", "#2563eb"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "night";
export const THEME_STORAGE_KEY = "triq_theme";

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && THEMES.some((t) => t.id === v);
}

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
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
}

/**
 * Inline <head> script: sets data-theme before first paint so there is no flash of the
 * default palette. Kept tiny and dependency-free.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t&&/^(${THEMES.map((t) => t.id).join("|")})$/.test(t)){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
