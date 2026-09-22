import type { Metadata, Viewport } from "next";
import { brand } from "@huddle/brand";
import { bigShoulders, instrumentSans } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.name,
  description: `${brand.tagline} ${brand.secondaryTagline}`,
  applicationName: brand.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.name,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${instrumentSans.variable}`}>
      <body>
        <Providers>
          <div className="mx-auto min-h-dvh max-w-phone bg-bg">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
