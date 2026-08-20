import type { Metadata } from "next";
import { AlternativesLandingPage } from "@/components/marketing/alternatives-landing-page";
import { vitaluAlternativesConfig, VITALU_ALT_PATH } from "@/lib/vitalu-alternatives";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: vitaluAlternativesConfig.meta.metaTitle,
  description: vitaluAlternativesConfig.meta.metaDescription,
  keywords: [...vitaluAlternativesConfig.meta.keywords],
  alternates: { canonical: VITALU_ALT_PATH },
  openGraph: {
    title: vitaluAlternativesConfig.meta.metaTitle,
    description: vitaluAlternativesConfig.meta.metaDescription,
    url: `${getSiteUrl()}${VITALU_ALT_PATH}`,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: vitaluAlternativesConfig.meta.metaTitle,
    description: vitaluAlternativesConfig.meta.metaDescription,
  },
};

function AlternativesJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: vitaluAlternativesConfig.meta.title,
    description: vitaluAlternativesConfig.meta.metaDescription,
    dateModified: "2026-08-17",
    author: { "@type": "Organization", name: "MyMotiveLife", url: siteUrl },
    publisher: { "@type": "Organization", name: "MyMotiveLife", url: siteUrl },
    mainEntityOfPage: `${siteUrl}${VITALU_ALT_PATH}`,
    about: [
      { "@type": "Thing", name: "MyFitnessPal alternatives" },
      { "@type": "SoftwareApplication", name: "Vitalu" },
    ],
    abstract: `Independent-style comparison of wellness apps, published by MyMotiveLife. Last reviewed ${vitaluAlternativesConfig.reviewed}.`,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export default function VitaluAlternativesRoute() {
  return (
    <>
      <AlternativesJsonLd />
      <AlternativesLandingPage config={vitaluAlternativesConfig} />
    </>
  );
}
