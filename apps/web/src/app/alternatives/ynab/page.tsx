import type { Metadata } from "next";
import { AlternativesLandingPage } from "@/components/marketing/alternatives-landing-page";
import { kashuAlternativesConfig, KASHU_ALT_PATH } from "@/lib/kashu-alternatives";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: kashuAlternativesConfig.meta.metaTitle,
  description: kashuAlternativesConfig.meta.metaDescription,
  keywords: [...kashuAlternativesConfig.meta.keywords],
  alternates: { canonical: KASHU_ALT_PATH },
  openGraph: {
    title: kashuAlternativesConfig.meta.metaTitle,
    description: kashuAlternativesConfig.meta.metaDescription,
    url: `${getSiteUrl()}${KASHU_ALT_PATH}`,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: kashuAlternativesConfig.meta.metaTitle,
    description: kashuAlternativesConfig.meta.metaDescription,
  },
};

function AlternativesJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: kashuAlternativesConfig.meta.title,
    description: kashuAlternativesConfig.meta.metaDescription,
    dateModified: "2026-08-17",
    author: { "@type": "Organization", name: "MyMotiveLife", url: siteUrl },
    publisher: { "@type": "Organization", name: "MyMotiveLife", url: siteUrl },
    mainEntityOfPage: `${siteUrl}${KASHU_ALT_PATH}`,
    about: [
      { "@type": "Thing", name: "YNAB alternatives" },
      { "@type": "SoftwareApplication", name: "Kashu" },
    ],
    abstract: `Independent-style comparison of budget and cash-flow apps, published by MyMotiveLife. Last reviewed ${kashuAlternativesConfig.reviewed}.`,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export default function KashuAlternativesRoute() {
  return (
    <>
      <AlternativesJsonLd />
      <AlternativesLandingPage config={kashuAlternativesConfig} />
    </>
  );
}
