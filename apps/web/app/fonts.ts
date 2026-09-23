import { Big_Shoulders, Instrument_Sans } from "next/font/google";

// Display = Big Shoulders Display 800-900, uppercase, lh .88 (handoff §5).
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
