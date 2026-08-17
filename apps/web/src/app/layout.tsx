import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { PageViewTracker } from "@/components/page-view-tracker";
import { PwaRegister } from "@/components/pwa-register";
import { CookieNotice } from "@/components/cookie-notice";
import { SiteJsonLd } from "@/components/marketing/site-json-ld";
import { WebAnalytics } from "@/components/web-analytics";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

/** Local fonts — avoid next/font/google fetch failures on Vercel builds. */
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

const syne = localFont({
  src: [
    { path: "./fonts/syne-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/syne-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/syne-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-syne",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

const siteUrl = getSiteUrl();

const META_DESCRIPTION =
  "MotiveLife builds a living Digital Twin of you — DayO, LifeVue, UPLIFT, Kashu, and VYRA for your life; KINZO AI for your family. Pro $14.99 CAD/month (14-day free trial) · KINZO $19.99 CAD/month · Family Pro Upgrade $9.99 CAD/month for active household members.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MotiveLife — AI Life Operating System | mymotivelife.com",
    template: "%s | MotiveLife — AI Life Operating System",
  },
  description: META_DESCRIPTION,
  applicationName: "MotiveLife",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  keywords: [
    "MotiveLife",
    "DayO",
    "LifeVue",
    "KINZO AI",
    "UPLIFT",
    "Kashu",
    "Cash-Flow Intelligence",
    "Safe to Spend",
    "Payday Mode",
    "Can I Afford",
    "no bank connection",
    "VYRA AI",
    "MyMotiveLife Pro",
    "Digital Twin",
    "AI Life Operating System",
    "family location intelligence",
    "AI personal assistant",
    "Life Momentum",
    "$14.99 CAD",
    "$19.99 CAD",
    "Family Pro Upgrade",
    "$9.99 CAD",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: siteUrl,
    siteName: "MotiveLife",
    title: "MotiveLife — AI Life Operating System",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "MotiveLife — AI Life Operating System",
    description: META_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MotiveLife",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#050d18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${syne.variable}`}>
        <SiteJsonLd />
        {children}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <CookieNotice />
        <PwaRegister />
        <WebAnalytics />
      </body>
    </html>
  );
}
