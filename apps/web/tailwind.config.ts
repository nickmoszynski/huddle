import type { Config } from "tailwindcss";

// Reads the CSS custom properties defined in app/globals.css, which mirror
// packages/brand/src/tokens.ts. Keep the two in sync — see the comment at
// the top of globals.css.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        s1: "var(--s1)",
        s2: "var(--s2)",
        s3: "var(--s3)",
        line: "var(--line)",
        line2: "var(--line2)",
        tx: "var(--tx)",
        mu: "var(--mu)",
        mu2: "var(--mu2)",
        ac: "var(--ac)",
        "ac-ink": "var(--ac-ink)",
        "ac-soft": "var(--ac-soft)",
        live: "var(--live)",
        gold: "var(--gold)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        ui: ["var(--font-ui)", "sans-serif"],
      },
      borderRadius: {
        tile: "22px",
        control: "14px",
        pill: "999px",
      },
      spacing: {
        gutter: "20px",
      },
      transitionTimingFunction: {
        huddle: "cubic-bezier(.2,.8,.2,1)",
      },
      transitionDuration: {
        fast: "180ms",
        base: "260ms",
        screen: "320ms",
      },
      maxWidth: {
        phone: "430px",
      },
    },
  },
  plugins: [],
};

export default config;
