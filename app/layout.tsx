import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";

import { getAppUrl } from "@/lib/app-url";

import "./globals.css";

/**
 * One family throughout. Outfit is geometric and wide-set, built the same way
 * as the locked SPLITCORE wordmark, so live type and the brand art agree.
 * Self-hosted by next/font — no third-party request on the guest's first paint.
 */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: { default: "Splitcore", template: "%s · Splitcore" },
  description:
    "Tip entertainers instantly by scanning a QR code. No app, no login, no cash.",
  applicationName: "Splitcore",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-mark.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "Splitcore",
    title: "Splitcore",
    description:
      "Tip entertainers instantly by scanning a QR code. No app, no login, no cash.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Splitcore" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Splitcore",
    description: "Tip entertainers instantly by scanning a QR code.",
    images: ["/og-image.png"],
  },
  // Staff tooling and one-time guest links: nothing here belongs in an index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
