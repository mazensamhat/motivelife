import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { PageViewTracker } from "@/components/page-view-tracker";
import { PwaRegister } from "@/components/pwa-register";
import { CookieNotice } from "@/components/cookie-notice";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "motivelife.ai — Just talk. Your AI life operating system.",
  description:
    "Speak your thoughts — MotiveLife turns them into plans, goals, habits, and daily actions. Morning briefings, Life Score, and voice organize. 14-day free trial, no credit card.",
  applicationName: "motivelife.ai",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "motivelife.ai",
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
