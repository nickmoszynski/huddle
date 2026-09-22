/**
 * Design tokens — ported 1:1 from CLAUDE_CODE_HANDOFF.md §5 and verified
 * against the two concept boards (design/boards/*.png).
 *
 * This is the ONLY place color/type/shape/motion values are defined.
 * apps/web/app/globals.css turns these into CSS vars; Tailwind reads the vars.
 */

export const colors = {
  bg: "#000000",
  s1: "#121315",
  s2: "#1A1B1E",
  s3: "#26272B",
  line: "rgba(255,255,255,.08)",
  line2: "rgba(255,255,255,.15)",
  tx: "#F5F5F2",
  mu: "#8E8F95",
  mu2: "#5E5F65",
  // the only accent color in the product
  ac: "#3DE07F",
  acInk: "#03140A",
  acSoft: "rgba(61,224,127,.1)",
  // LIVE dot / loss states only
  live: "#FF4538",
  // streaks / leaderboard #1 only
  gold: "#F2D04B",
} as const;

export const fonts = {
  display: "'Big Shoulders Display', sans-serif", // 800-900, uppercase, lh .88
  ui: "'Instrument Sans', sans-serif", // 400-700
} as const;

export const type = {
  displayLg: { size: "66px", weight: 900, lh: 0.88 },
  displayMd: { size: "52px", weight: 800, lh: 0.88 },
  displaySm: { size: "34px", weight: 800, lh: 0.88 },
  body: { size: "15px", weight: 400, lh: 1.4 },
  meta: { size: "13px", weight: 500, lh: 1.3 },
  caps: { size: "11px", weight: 700, lh: 1.2, tracking: "0.08em" },
} as const;

export const radius = {
  tile: 22,
  control: 14,
  pill: 999,
} as const;

export const space = {
  grid: 4,
  gutter: 20,
} as const;

export const hitTargets = {
  buttonPrimary: 52,
  min: 44,
} as const;

export const motion = {
  fast: "180ms cubic-bezier(.2,.8,.2,1)",
  base: "260ms cubic-bezier(.2,.8,.2,1)",
  screen: "320ms cubic-bezier(.2,.8,.2,1)",
  reactionFloat: "1600ms",
  scoreBump: "500ms",
} as const;
