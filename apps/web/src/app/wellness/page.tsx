import type { Metadata } from "next";
import { VitaluLandingPage } from "@/components/marketing/vitalu-landing-page";
import {
  VITALU_META_DESCRIPTION,
  VITALU_META_TITLE,
  VITALU_PAGE_PATH,
  VITALU_PRODUCT_NAME,
} from "@/lib/vitalu-marketing";
import { PLAN_PRICE_CAD } from "@/lib/marketing-copy";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: VITALU_META_TITLE,
  description: VITALU_META_DESCRIPTION,
  keywords: [
    "Vitalu",
    "Health Intelligence",
    "Vital Score",
    "wellness plan",
    "MyMotiveLife",
    "not medical advice",
  ],
  alternates: { canonical: VITALU_PAGE_PATH },
  openGraph: {
    title: VITALU_META_TITLE,
    description: VITALU_META_DESCRIPTION,
    url: `${getSiteUrl()}${VITALU_PAGE_PATH}`,
    type: "website",
  },
};

function VitaluJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: VITALU_PRODUCT_NAME,
    applicationCategory: "HealthApplication",
    operatingSystem: "Web, iOS, Android",
    url: `${siteUrl}${VITALU_PAGE_PATH}`,
    description: VITALU_META_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "14.99",
      priceCurrency: "CAD",
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/register`,
      description: `${VITALU_PRODUCT_NAME} Health Intelligence is included with MyMotiveLife Pro (${PLAN_PRICE_CAD}). General wellness software — not medical advice. Health connections optional.`,
    },
    isRelatedTo: {
      "@type": "SoftwareApplication",
      name: "MyMotiveLife",
      url: siteUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function WellnessMarketingPage() {
  return (
    <>
      <VitaluJsonLd />
      <VitaluLandingPage />
    </>
  );
}
