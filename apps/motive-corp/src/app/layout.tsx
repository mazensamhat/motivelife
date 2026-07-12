import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import { OrganizationJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TrackClicks } from "@/components/track-clicks";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.motive-corp.com"),
  title: {
    default: "Motive-Corp | One vision. Four platforms.",
    template: "%s | Motive-Corp",
  },
  description:
    "Motive-Corp builds AI platforms for better decisions — MotiveLife, MotiveIQ, MotiveFX, and MotivePulse IQ.",
  openGraph: {
    title: "Motive-Corp | One vision. Four platforms.",
    description:
      "AI platforms that help people live better, trade faster, and grow local businesses — plus Automotive Intelligence.",
    url: "https://www.motive-corp.com",
    siteName: "Motive-Corp",
    images: [{ url: "/brand/motive-corp-logo.png", width: 1200, height: 1200 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Motive-Corp",
    description: "One vision. Four platforms. Endless possibilities.",
    images: ["/brand/motive-corp-logo.png"],
  },
  alternates: {
    canonical: "https://www.motive-corp.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-void font-[family-name:var(--font-body)] text-snow antialiased">
        <OrganizationJsonLd />
        <TrackClicks />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
