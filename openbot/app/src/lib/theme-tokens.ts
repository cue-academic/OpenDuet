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
  surface: "#f1f2ec",
  card: "#fbfcf7",
  bubble: "#e3e7da",
  tile: "#e6e9df",
  ink: "#111a16",
  "ink-2": "#36423c",
  "ink-3": "#515d57",
  hair: "rgb(17 26 22 / 14%)",
  accent: "#07564f",
  "accent-soft": "#e2f3b4",
  "on-accent": "#ffffff",
  "status-done": "#1a6b2a",
  "status-needs": "#8f4a06",
  "status-working": "#1d4ed8",
  "status-problem": "#b91c1c",
  black: "#111a16",
  "on-black": "#fbfcf7",
};

export const DARK_TOKENS: ThemeTokens = {
  surface: "#0c1310",
  card: "#151e1a",
  bubble: "#1f2a25",
  tile: "#1f2a25",
  ink: "#eef2e8",
  "ink-2": "#c9d1c6",
  "ink-3": "#a9b4a8",
  hair: "rgb(255 255 255 / 10%)",
  accent: "#d6f24a",
  "accent-soft": "#2a3a14",
  "on-accent": "#14200a",
  "status-done": "#4ade80",
  "status-needs": "#fbbf24",
  "status-working": "#93c5fd",
  "status-problem": "#fca5a5",
  black: "#eef2e8",
  "on-black": "#0c1310",
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
export const RADII = { bubble: 16, card: 14, field: 14, tile: 8 } as const;

/** The declarations for one theme, as `--duet-<name>: <value>;` lines. */
export function tokenDeclarations(tokens: ThemeTokens): string {
  return Object.entries(tokens)
    .map(([name, value]) => `--duet-${name}: ${value};`)
    .join(" ");
}
