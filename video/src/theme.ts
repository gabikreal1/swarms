/** SWARMS Video v2 — Theme & Constants */

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 2700, // 90s
} as const;

/* ── Scene durations (frames) ──────────────────────────── */
export const SCENE = {
  trustVacuum: 240, //  8s
  discoveryProblem: 240, //  8s
  enterSwarms: 300, // 10s
  butler: 300, // 10s
  bidding: 270, //  9s
  lock: 240, //  8s
  validation: 300, // 10s
  reputation: 270, //  9s
  forBuilders: 270, //  9s
  future: 270, //  9s
} as const;

/** Cumulative start frame for each scene */
export const SCENE_START = (() => {
  const keys = Object.keys(SCENE) as (keyof typeof SCENE)[];
  const starts: Record<string, number> = {};
  let acc = 0;
  for (const k of keys) {
    starts[k] = acc;
    acc += SCENE[k];
  }
  return starts as Record<keyof typeof SCENE, number>;
})();

/* ── Accent palette (one per scene) ───────────────────── */
export const ACCENT = {
  red: "#FF453A",
  orange: "#FF9F0A",
  blue: "#2997FF",
  purple: "#BF5AF2",
  yellow: "#FFD60A",
  green: "#30D158",
  indigo: "#5E5CE6",
  white: "#FFFFFF",
} as const;

export const SCENE_ACCENT: Record<keyof typeof SCENE, string> = {
  trustVacuum: ACCENT.red,
  discoveryProblem: ACCENT.orange,
  enterSwarms: ACCENT.blue,
  butler: ACCENT.purple,
  bidding: ACCENT.blue,
  lock: ACCENT.yellow,
  validation: ACCENT.green,
  reputation: ACCENT.indigo,
  forBuilders: ACCENT.blue,
  future: ACCENT.blue,
};

/* ── Typography ───────────────────────────────────────── */
export const FONT = {
  heading: "SF Pro Display, -apple-system, Helvetica Neue, sans-serif",
  mono: "SF Mono, Menlo, monospace",
} as const;

export const FONT_SIZE = {
  hero: 96,
  heading: 64,
  subtitle: 28,
  body: 22,
  label: 18,
  cta: 36,
} as const;

/* ── Motion defaults ──────────────────────────────────── */
export const MOTION = {
  wordStagger: 5, // frames between words
  entryDuration: 35, // frames for element entry
  fadeDuration: 15, // frames for cross-scene fade
  glowOpacity: 0.1, // 10% max
} as const;

/* ── Shared spring config ─────────────────────────────── */
export const SPRING_GENTLE = {
  damping: 26,
  mass: 0.8,
  stiffness: 120,
} as const;

export const SPRING_SNAPPY = {
  damping: 20,
  mass: 0.5,
  stiffness: 200,
} as const;

/* ── Background ───────────────────────────────────────── */
export const BG = "#000000";
