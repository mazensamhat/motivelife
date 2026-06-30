import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { PageViewTracker } from "@/components/page-view-tracker";
import { PwaRegister } from "@/components/pwa-register";
import { CookieNotice } from "@/components/cookie-notice";
import { Analytics } from "@vercel/analytics/react";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MotiveLife — AI Life Coach & Daily Planner | mymotivelife.com",
    template: "%s | MotiveLife",
  },
  description:
    "MotiveLife (mymotivelife.com) — speak your thoughts and get plans, goals, habits, and daily actions. AI morning briefings, Life Score, and voice organize. 14-day free trial, no credit card.",
  applicationName: "MotiveLife",
  keywords: [
    "MotiveLife",
    "mymotivelife",
    "AI life coach",
    "AI goal planner",
    "AI habit tracker",
    "AI daily planner",
    "voice organize",
    "personal AI assistant Canada",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: siteUrl,
    siteName: "MotiveLife",
    title: "MotiveLife — Just talk. Your AI life operating system.",
    description:
      "Stop juggling apps. MotiveLife turns your voice into plans, goals, and daily actions — with morning briefings and Life Score tracking.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MotiveLife — AI life operating system",
    description:
      "Just talk. MotiveLife turns your thoughts into plans, goals, habits, and actions. Free 14-day trial.",
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
  themeColor: "#0072ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        {children}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <CookieNotice />
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
