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
    default: "MotiveLife — AI Life Operating System | mymotivelife.com",
    template: "%s | MotiveLife — AI Life Operating System",
  },
  description:
    "MotiveLife is the AI Life Operating System — one AI that understands your calendar, money, health, goals, and habits. Life Score, predictions, and daily briefings. 14-day free trial.",
  applicationName: "MotiveLife",
  keywords: [
    "MotiveLife",
    "AI Life Operating System",
    "AI life coach",
    "AI personal assistant",
    "AI daily planner",
    "AI calendar planner",
    "life management software",
    "personal operating system",
    "AI memory app",
    "best AI planner",
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
    description:
      "One AI that understands your calendar, money, health, and goals. Life Score, predictions, and daily briefings. 14-day free trial.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MotiveLife — AI Life Operating System",
    description:
      "Why trust an AI with your life? MotiveLife connects every part of your life in one private system. Free 14-day trial.",
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
