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
  surface: "#f7f4ed",
  card: "#fffdf9",
  bubble: "#ededed",
  tile: "#eee9e1",
  ink: "#272238",
  "ink-2": "#484158",
  "ink-3": "#635b70",
  hair: "rgb(39 34 56 / 14%)",
  accent: "#5635a1",
  "accent-soft": "#ebe2ff",
  "on-accent": "#ffffff",
  "status-done": "#1a6b2a",
  "status-needs": "#8f4a06",
  "status-working": "#1d4ed8",
  "status-problem": "#b91c1c",
  black: "#272238",
  "on-black": "#fffdf9",
};

export const DARK_TOKENS: ThemeTokens = {
  surface: "#191624",
  card: "#231e31",
  bubble: "#2f2f2f",
  tile: "#2f293c",
  ink: "#f4effa",
  "ink-2": "#d7cbdf",
  "ink-3": "#bdb2c8",
  hair: "rgb(255 255 255 / 10%)",
  accent: "#cfb7ff",
  "accent-soft": "#3b2d53",
  "on-accent": "#281944",
  "status-done": "#4ade80",
  "status-needs": "#fbbf24",
  "status-working": "#93c5fd",
  "status-problem": "#fca5a5",
  black: "#f4effa",
  "on-black": "#191624",
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
