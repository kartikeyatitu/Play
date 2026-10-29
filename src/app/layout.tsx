import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { getAppUrl } from "@/lib/app-url";
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from "@/lib/theme";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

import { ThemedToaster } from "@/components/ui/themed-toaster";
import { AnalyticsInit } from "@/components/analytics/AnalyticsInit";
import { Analytics } from "@vercel/analytics/next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
  themeColor: "#f7f7f5",
};

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: "Triq | Sports Academy Platform",
  description: "Complete sports academy management — batches, fees, attendance, student progress, coach verification, and parent engagement. Built for cricket, football, tennis, and multi-sport academies.",
  keywords: ["sports academy", "academy management", "cricket academy", "football academy", "student management", "fee management", "attendance tracking", "coach management", "Triq", "Triq Sports"],
  authors: [{ name: "Triq" }],
  openGraph: {
    title: "Triq — Modern Sports Academy Platform",
    description: "Run your sports academy like a pro. Manage batches, fees, attendance, athlete progress & parent communication — all in one place.",
    url: getAppUrl(),
    siteName: "Triq",
    type: "website",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "Triq — Modern Sports Academy Platform",
    description: "Run your sports academy like a pro. Manage batches, fees, attendance & athlete growth.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning className={cn("dark", "font-sans", geist.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased min-h-screen bg-canvas text-ink font-sans">
        <main>{children}</main>
        <ThemedToaster />
        <AnalyticsInit />
        <Analytics />
      </body>
    </html>
  );
}
