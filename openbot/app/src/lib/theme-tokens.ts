/**
 * OpenDuet's colour tokens as data, for what cannot read the stylesheet: the interface a Bot writes
 * runs in a sandboxed frame with no access to `styles.css`, so the prompt that tells it how to look
 * (`lib/copilot/generative-ui.ts`) is built from these.
 *
 * The values are the stylesheet's own. `tests/visual-system.test.ts` reads `src/styles.css` and
 * fails when any value here differs from the `--duet-<name>` it stands for, so the two cannot drift.
 */
export type ThemeTokens = {
  surface: string;
  card: string;
  bubble: string;
  tile: string;
  ink: string;
  "ink-2": string;
  "ink-3": string;
  hair: string;
  accent: string;
  "accent-soft": string;
  "on-accent": string;
  "status-done": string;
  "status-needs": string;
  "status-working": string;
  "status-problem": string;
  black: string;
  "on-black": string;
};

export const LIGHT_TOKENS: ThemeTokens = {
  surface: "#ffffff",
  card: "#ffffff",
  bubble: "#f4f6ff",
  tile: "#f4f6ff",
  ink: "#111214",
  "ink-2": "#394158",
  "ink-3": "#555d73",
  hair: "rgb(17 18 20 / 10%)",
  accent: "#2f5dff",
  "accent-soft": "#e0e7ff",
  "on-accent": "#ffffff",
  "status-done": "#146c34",
  "status-needs": "#854d0e",
  "status-working": "#1d4ed8",
  "status-problem": "#b91c1c",
  black: "#2f5dff",
  "on-black": "#ffffff",
};

export const DARK_TOKENS: ThemeTokens = {
  surface: "#101425",
  card: "#191f35",
  bubble: "#222b46",
  tile: "#222b46",
  ink: "#f5f7ff",
  "ink-2": "#dce3f8",
  "ink-3": "#b9c3df",
  hair: "rgb(255 255 255 / 10%)",
  accent: "#b4c5ff",
  "accent-soft": "#25345f",
  "on-accent": "#101425",
  "status-done": "#4ade80",
  "status-needs": "#fbbf24",
  "status-working": "#93c5fd",
  "status-problem": "#fca5a5",
  black: "#b4c5ff",
  "on-black": "#101425",
};

/** The type scale in px (parity-spec 2.3), the sizes the app's `type-*` utilities draw at 16px. */
export const TYPE_SCALE = {
  display: { size: 24, line: 28, weight: 600 },
  nav: { size: 18, line: 22, weight: 500 },
  body: { size: 17, line: 23, weight: 400 },
  sub: { size: 15, line: 20, weight: 400 },
  caption: { size: 13, line: 16, weight: 400 },
} as const;

/** The radii (parity-spec 2.4), in px. Pills, chips and buttons are fully round. */
export const RADII = { bubble: 20, card: 20, field: 22, tile: 10 } as const;

/** The declarations for one theme, as `--duet-<name>: <value>;` lines. */
export function tokenDeclarations(tokens: ThemeTokens): string {
  return Object.entries(tokens)
    .map(([name, value]) => `--duet-${name}: ${value};`)
    .join(" ");
}
