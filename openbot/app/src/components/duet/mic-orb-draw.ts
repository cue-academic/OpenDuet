/**
 * Cue's dot, drawn on the existing presence canvas: a flat circle and two upright pill eyes.
 * Motion still belongs to MicOrb, so typing, working, reduced motion and the startup flight keep
 * their existing lifecycle. The face has no gradients, shadows, microphone parts or mouth.
 */

const TAU = Math.PI * 2;
const PI = Math.PI;

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const eio = (u: number) => {
  const v = clamp(u);
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
};
const eout = (u: number) => 1 - (1 - clamp(u)) ** 3;
const smooth = (u: number) => {
  const v = clamp(u);
  return v * v * (3 - 2 * v);
};
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(PI * u) ** 2);

// ---------- motion: keyed tracks with eases and closed-form springs ----------

/** One move of a track: to `to` from time `at`, over an ease of `ease` seconds or on a spring of [stiffness, damping]. */
export type TrackKey =
  | { at: number; to: number; ease: number }
  | { at: number; to: number; spring: readonly [number, number] };

/** A value that starts at `from` and moves through its keys in order. */
export type Track = { from: number; keys: TrackKey[] };

/** Step response of a damped spring: closed form, so it is a pure function of elapsed time. */
function springStep(tau: number, w: number, z: number) {
  if (tau <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
  const wd = w * Math.sqrt(1 - z * z);
  return (
    1 -
    Math.exp(-z * w * tau) *
      (Math.cos(wd * tau) + ((z * w) / wd) * Math.sin(wd * tau))
  );
}

/**
 * The track's value at time t. Each key moves the value from the previous key's value to its own,
 * and the responses are summed, which for springs is exactly a spring chasing a stepped target:
 * anticipation, overshoot and settle all fall out of the same maths.
 */
export function track(tr: Track, t: number) {
  let v = tr.from;
  let prev = tr.from;
  for (const k of tr.keys) {
    if (t < k.at) break;
    const tau = t - k.at;
    const r =
      "ease" in k
        ? eio(tau / k.ease)
        : springStep(tau, k.spring[0], k.spring[1]);
    v += (k.to - prev) * r;
    prev = k.to;
  }
  return v;
}

/** A blink at `tau` seconds after it starts: shut fast, open slower, 0.24 s in all. */
export function blinkCurve(tau: number) {
  if (tau < 0 || tau > 0.24) return 0;
  return tau < 0.07 ? eout(tau / 0.07) : 1 - eio((tau - 0.07) / 0.17);
}

/** A nod that rings down, `tau` seconds after it starts. */
export function nodCurve(tau: number) {
  return tau >= 0 && tau < 2.2 ? Math.exp(-3 * tau) * Math.sin(8 * tau) : 0;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Where it looks while nothing needs it: mostly at you, now and then a glance aside and back.
 * Each look snaps over 0.14 s and then holds, so the pauses are part of the motion.
 */
export function restLook(ta: number, period: number, seed: number) {
  const k = Math.floor(ta / period);
  const f = ta - k * period;
  const at = (n: number): [number, number, number] => {
    const r = mulberry32((seed * 7919 + n * 104729) | 0);
    return r() < 0.55
      ? [0, 0, 0]
      : [(r() * 2 - 1) * 0.7, (r() * 2 - 1) * 0.4, (r() * 2 - 1) * 0.24];
  };
  const a = at(k - 1);
  const b = at(k);
  const u = eout(f / 0.14);
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

// ---------- colour ----------

type Rgb = [number, number, number];

function ok2rgb(L: number, C: number, h: number): Rgb | null {
  const hr = (h * PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const out: number[] = [];
  for (const x of linear) {
    if (x < -0.002 || x > 1.002) return null;
    const c = clamp(x);
    out.push(
      Math.round(
        255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055),
      ),
    );
  }
  return out as Rgb;
}

/** An oklch colour as sRGB, losing chroma until it fits rather than clipping its hue. */
export function oklch(L: number, C: number, h: number): Rgb {
  let chroma = C;
  for (let i = 0; i < 40; i++) {
    const c = ok2rgb(L, chroma, h);
    if (c) return c;
    chroma *= 0.95;
  }
  return ok2rgb(L, 0, h) ?? [128, 128, 128];
}

/**
 * The orb's colours, as oklch [L, C, h]: four tones for the sphere's drifting colour and its pale
 * base. `violet` is also the deep tone the grilles are made of, and `mag` the light their slots glow
 * with; `shade` tints the sphere's rim, as an rgb triple.
 *
 * Ocean is OpenDuet's own. The other three are the orb's other colours, the same four the launch
 * film's title draws (launch-film/film/src/duet/micorb.ts), and are what every other Bot wears, so a
 * roster reads as one family of Duets rather than OpenDuet beside unrelated discs.
 */
const PALETTES = {
  ocean: {
    pink: [0.75, 0.13, 232],
    blue: [0.74, 0.13, 205],
    violet: [0.53, 0.2, 262],
    mag: [0.86, 0.08, 220],
    bg: [0.93, 0.025, 235],
    shade: "14,30,80",
  },
  ember: {
    pink: [0.66, 0.19, 15],
    blue: [0.8, 0.15, 72],
    violet: [0.6, 0.19, 38],
    mag: [0.88, 0.12, 90],
    bg: [0.95, 0.03, 70],
    shade: "92,34,20",
  },
  lime: {
    pink: [0.88, 0.19, 125],
    blue: [0.74, 0.17, 145],
    violet: [0.52, 0.14, 150],
    mag: [0.93, 0.15, 108],
    bg: [0.96, 0.04, 122],
    shade: "22,62,36",
  },
  graphite: {
    pink: [0.84, 0.015, 260],
    blue: [0.64, 0.2, 256],
    violet: [0.4, 0.03, 265],
    mag: [0.82, 0.1, 250],
    bg: [0.86, 0.01, 260],
    shade: "15,18,30",
  },
  // Academic OS's own picks, so a student can make the coach theirs.
  berry: {
    pink: [0.72, 0.2, 350],
    blue: [0.66, 0.2, 300],
    violet: [0.48, 0.22, 310],
    mag: [0.88, 0.1, 340],
    bg: [0.95, 0.03, 330],
    shade: "70,20,70",
  },
  sunset: {
    pink: [0.72, 0.2, 20],
    blue: [0.78, 0.17, 300],
    violet: [0.55, 0.22, 330],
    mag: [0.9, 0.12, 60],
    bg: [0.95, 0.03, 30],
    shade: "90,30,50",
  },
  mint: {
    pink: [0.86, 0.14, 170],
    blue: [0.78, 0.13, 195],
    violet: [0.52, 0.14, 180],
    mag: [0.92, 0.1, 160],
    bg: [0.96, 0.03, 175],
    shade: "20,70,65",
  },
  gold: {
    pink: [0.84, 0.17, 85],
    blue: [0.76, 0.16, 60],
    violet: [0.56, 0.17, 50],
    mag: [0.93, 0.12, 95],
    bg: [0.96, 0.04, 85],
    shade: "90,60,15",
  },
} as const;

/** Every colour the orb can wear, in the order the avatar picker shows them. */
export const ORB_COLOURS = Object.keys(PALETTES) as OrbColour[];

/** One of the orb's colours. Ocean is OpenDuet's own. */
export type OrbColour = keyof typeof PALETTES;
type Tone = "pink" | "blue" | "violet" | "mag" | "bg";

type Palette = Record<Tone, Rgb> & { shade: string };
const paletteMemo = new Map<string, Palette>();

/** A colour with its saturation and hue nudged, as the orb livens when it listens and cools when it works. */
export function palette(
  sat: number,
  hue: number,
  colour: OrbColour = "ocean",
): Palette {
  const ks = Math.round(clamp(sat, 0.5, 1.3) * 50) / 50;
  const kh = Math.round(hue * 2) / 2;
  const key = `${colour}|${ks}|${kh}`;
  let p = paletteMemo.get(key);
  if (!p) {
    const set = PALETTES[colour];
    const c = (k: Tone, sk = ks, hk = kh) =>
      oklch(set[k][0], set[k][1] * sk, set[k][2] + hk);
    p = {
      pink: c("pink"),
      blue: c("blue"),
      violet: c("violet"),
      mag: c("mag"),
      bg: c("bg", 1, kh * 0.5),
      shade: set.shade,
    };
    paletteMemo.set(key, p);
  }
  return p;
}

// ---------- the pose ----------

/** Everything one frame depends on. `ta` is seconds on the orb's own clock; ages are -1 when nothing happened yet. */
export type OrbPose = {
  ta: number;
  /** 0 at rest, 1 listening (can overshoot a little). */
  listen: number;
  think: number;
  /** The landing's glow, 0 to 1. */
  done: number;
  smile: number;
  tilt: number;
  /** Where it looks: right and down, about -1 to 1. */
  ax: number;
  ay: number;
  blink: number;
  nod: number;
  /** A keystroke's kick, 0 to 1, that lights the grilles' slots like a level meter. */
  key: number;
  doneAge: number;
  noticeAge: number;
  /** Seconds into a finish (a check and a burst of rays, `finishPhase`), or -1 when none is playing. */
  finishAge: number;
  /** -1 to 1, a slow breath. */
  breath: number;
};

// ---------- the finish ----------

/** How long a finish plays, in seconds, from the eyes giving way to the check until they are back. */
export const FINISH_S = 1.2;
/** A moment in a finish when the check is whole and the rays have gone: the finish as a still. */
export const FINISH_HELD = 0.8;
/** The short strokes that burst out round the orb when it finishes. */
export const RAYS = 10;

/** Where a finish is at one moment. Every part of it is a pure function of its age. */
export type FinishPhase = {
  /** How much of the check is drawn along its stroke, 0 to 1. */
  check: number;
  /** The check's opacity: whole while it holds, gone as the eyes come back. */
  checkAlpha: number;
  /** How far the rays have flown, 0 to 1, or -1 before they leave and once they have faded. */
  rays: number;
  /** The eye-lights' opacity: they give way to the check and come back after it. */
  eyes: number;
  /** The sphere's pop as the check lands, 0 to 1. */
  pop: number;
};

const NO_FINISH: FinishPhase = {
  check: 0,
  checkAlpha: 0,
  rays: -1,
  eyes: 1,
  pop: 0,
};

/**
 * A finish `age` seconds in: the eyes fade as the sphere pops and the check strokes on, the rays
 * burst outward and fade, the check holds, then fades as the eyes come back. -1 is no finish.
 */
export function finishPhase(age: number): FinishPhase {
  if (!(age >= 0 && age < FINISH_S)) return NO_FINISH;
  const back = smooth((age - 0.85) / 0.3);
  return {
    check: eout((age - 0.06) / 0.3),
    checkAlpha: 1 - back,
    rays: age >= 0.1 && age < 0.75 ? (age - 0.1) / 0.65 : -1,
    eyes: age < 0.85 ? 1 - smooth(age / 0.12) : back,
    pop: bump(age / 0.5),
  };
}

// ---------- Cue's flat dot ----------

/** Personal colour choices keep the same simple face. Cue's default is always its brand blue. */
export const DOT_COLOURS: Record<OrbColour, string> = {
  ocean: "#2f5dff",
  ember: "#c2410c",
  lime: "#4d7c0f",
  graphite: "#394158",
  berry: "#a21caf",
  sunset: "#be185d",
  mint: "#047857",
  gold: "#a16207",
};

/** Kept under the original API so every existing presence surface draws the same Cue face. */
export function drawMicOrb(
  ctx: CanvasRenderingContext2D,
  size: number,
  pose: OrbPose,
  { colour = "ocean" }: { dark: boolean; colour?: OrbColour },
) {
  const radius = size / 2;
  const finish = finishPhase(pose.finishAge);
  const scale = 1 + 0.025 * finish.pop;
  ctx.save();
  ctx.translate(0, pose.nod * radius * 0.06);
  ctx.scale(scale, scale);
  ctx.fillStyle = DOT_COLOURS[colour];
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.94, 0, TAU);
  ctx.fill();

  // The eyes stay upright and stay eyes, including when a task finishes.
  const width = radius * 0.23;
  const height = Math.max(
    radius * 0.08,
    radius * 0.64 * (1 - 0.88 * pose.blink),
  );
  const x = clamp(pose.ax, -1, 1) * radius * 0.1;
  const y = clamp(pose.ay, -1, 1) * radius * 0.1;
  ctx.fillStyle = "#ffffff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(
      side * radius * 0.29 - width / 2 + x,
      -height / 2 + y,
      width,
      height,
      width / 2,
    );
    ctx.fill();
  }
  ctx.restore();
}
