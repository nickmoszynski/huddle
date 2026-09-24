import { Barlow_Condensed, Instrument_Sans } from "next/font/google";

// Display = bold condensed uppercase, 800-900, lh .88 (handoff §5).
// Originally "Big Shoulders Display" / "Big Shoulders", but that family
// broke Netlify's production build: next@15.5.26's bundled next/font/google
// has no working fallback-metrics entry for any of the three "Big
// Shoulders" exports (Big_Shoulders, Big_Shoulders_Inline,
// Big_Shoulders_Stencil), and the font loader throws instead of degrading
// gracefully when it can't parse the font-file URL Google's CSS currently
// serves for that family. It never showed up in this sandbox's own build
// checks because Google Fonts isn't reachable here at all (fonts.ts gets
// stubbed out for local verification) — Netlify's real, network-connected
// build was the first thing to actually exercise this code path. Barlow
// Condensed is the same bold-condensed-uppercase shape at 800/900 and has
// a confirmed-working metrics entry. See DECISIONS.md.
export const bigShoulders = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-display",
  display: "swap",
});

// UI = Instrument Sans 400-700.
export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});
