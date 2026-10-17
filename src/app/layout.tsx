import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Barlow_Condensed } from "next/font/google";
import { cn } from "@/lib/utils";
import { getAppUrl } from "@/lib/app-url";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-heading",
  display: "swap",
});

import { Toaster } from "sonner";
import { AnalyticsInit } from "@/components/analytics/AnalyticsInit";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
  themeColor: "#09090b",
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
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Triq — Modern Sports Academy Platform",
    description: "Run your sports academy like a pro. Manage batches, fees, attendance & athlete growth.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-50 font-sans">
        <main>{children}</main>
        <Toaster theme="dark" position="top-right" richColors />
        <AnalyticsInit />
      </body>
    </html>
  );
}
