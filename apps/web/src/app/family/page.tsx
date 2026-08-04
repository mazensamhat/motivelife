import type { Metadata } from "next";
import { FamilyLandingPage } from "@/components/marketing/family-landing-page";
import {
  FAMILY_META_DESCRIPTION,
  FAMILY_META_TITLE,
  FAMILY_PAGE_PATH,
  FAMILY_PRICE_CAD,
  FAMILY_PRODUCT_NAME,
} from "@/lib/family-marketing";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: FAMILY_META_TITLE,
  description: FAMILY_META_DESCRIPTION,
  keywords: [
    "MyMotiveFamily",
    "Family Intelligence",
    "family location AI",
    "family map app",
    "MyMotiveLife",
    "MotiveLife Family",
    "household AI",
    "family ETA",
    "drive score family",
  ],
  alternates: { canonical: FAMILY_PAGE_PATH },
  openGraph: {
    title: FAMILY_META_TITLE,
    description: FAMILY_META_DESCRIPTION,
    url: `${getSiteUrl()}${FAMILY_PAGE_PATH}`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: FAMILY_META_TITLE,
    description: FAMILY_META_DESCRIPTION,
  },
};

function FamilyJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: FAMILY_PRODUCT_NAME,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web, iOS, Android",
    url: `${siteUrl}${FAMILY_PAGE_PATH}`,
    description: FAMILY_META_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: FAMILY_PRICE_CAD.toFixed(2),
      priceCurrency: "CAD",
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/family`,
      description: `${FAMILY_PRODUCT_NAME} — $${FAMILY_PRICE_CAD.toFixed(2)} CAD/month includes MyMotiveLife Pro for the account owner plus Family Intelligence for the household. Active invited members can unlock full private Pro for $9.99 CAD/month.`,
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

export default function FamilyPage() {
  return (
    <>
      <FamilyJsonLd />
      <FamilyLandingPage />
    </>
  );
}
