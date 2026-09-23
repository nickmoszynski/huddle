import { Big_Shoulders, Instrument_Sans } from "next/font/google";

// Display = Big Shoulders Display 800-900, uppercase, lh .88 (handoff §5).
// Google Fonts has since consolidated the separate "Big Shoulders Display"
// family into one variable "Big Shoulders" family (confirmed against
// next/font/google's bundled font catalog) — same type design, same
// weights available, just one import name now. See DECISIONS.md.
export const bigShoulders = Big_Shoulders({
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
