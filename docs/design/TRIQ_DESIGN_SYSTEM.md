# TRIQ Design System

Status legend: **Implemented** (in code) · **Planned** (documented, not built).

## Brand direction
- Deep navy / near-black foundations (dark theme canvas `--n-950`, surface `--n-900`). **Implemented** in `src/app/themes.css`.
- Clean white and neutral surfaces (light theme). **Implemented** (light tokens exist; light theme not yet visually reviewed on every screen).
- Electric lime primary highlight (`--a-400` = 198 255 61 dark; deep lime 77 122 0 on light for text contrast). **Implemented** on `design/sportos-ui-v1`.
- Text on lime is navy (`--c-accent-fg` = `--n-950`), never white. **Implemented.**
- Sports photography, purposeful gradients, app-shell redesign, public homepage. **Planned** (Sprint B remaining).

## Token rules
- New code uses semantic tokens: `canvas`, `surface`, `surface-2`, `line`, `ink`, `ink-muted`, `ink-subtle`, `volt`, `volt-fg`, `success`, `warn`, `danger` (see `tailwind.config.ts`).
- Legacy `zinc-*` classes in older components are being migrated; do not add new ones.
- Radius: cards `rounded-2xl`; controls `rounded-xl`. Shadows restrained (no decorative shadow on cards).

## Components restyled so far
- `Button` default variant → lime fill, navy text. **Implemented.**
- `Card` → semantic surface and line tokens, `rounded-2xl`, no shadow. **Implemented.**
- `Badge`, `Input`, `StatusChip`, `AthleticButton`, shell navigation, tables, dialogs. **Planned.**

## Accessibility targets
- Body text ≥ 4.5:1 against its surface; large text and UI boundaries ≥ 3:1.
- Lime is used for fills and highlights; text on lime is navy.
- Focus rings must be visible on both themes. **Planned verification.**

## Responsive rules
- 16px side gutter on phones; no horizontal page scroll.
- Mobile navigation: bottom bar for primary verticals, "More" sheet. **Planned.**

## Verification status
- `tsc --noEmit`: passing on this branch.
- `vitest run`: 266 tests passing.
- `next build`: see the commit message / report for the actual result.
- Visual review in a Vercel preview: **not yet performed** by this document.
