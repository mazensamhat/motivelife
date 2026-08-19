import type { Metadata } from "next";
import { Barlow, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Barlow({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "PM Intel | Dealer engagement intelligence",
  description:
    "Local-first performance manager assistant for last engagement, temperature, cadence, and director team scoring. Runs on this machine — dealer recaps never leave the browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-[family-name:var(--font-body)] antialiased">{children}</body>
    </html>
  );
}
