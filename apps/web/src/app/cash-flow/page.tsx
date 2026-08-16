import type { Metadata } from "next";
import { KashuLandingPage } from "@/components/marketing/kashu-landing-page";
import {
  KASHU_META_DESCRIPTION,
  KASHU_META_TITLE,
  KASHU_PAGE_PATH,
  KASHU_PRODUCT_NAME,
} from "@/lib/kashu-marketing";
import { PLAN_PRICE_CAD } from "@/lib/marketing-copy";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: KASHU_META_TITLE,
  description: KASHU_META_DESCRIPTION,
  keywords: [
    "Kashu",
    "Cash-Flow Intelligence",
    "Safe to Spend",
    "cash flow forecast",
    "bill timing",
    "MyMotiveLife",
    "MotiveLife money",
    "no bank connect",
  ],
  alternates: { canonical: KASHU_PAGE_PATH },
  openGraph: {
    title: KASHU_META_TITLE,
    description: KASHU_META_DESCRIPTION,
    url: `${getSiteUrl()}${KASHU_PAGE_PATH}`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: KASHU_META_TITLE,
    description: KASHU_META_DESCRIPTION,
  },
};

function KashuJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: KASHU_PRODUCT_NAME,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, iOS, Android",
    url: `${siteUrl}${KASHU_PAGE_PATH}`,
    description: KASHU_META_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "14.99",
      priceCurrency: "CAD",
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/register`,
      description: `${KASHU_PRODUCT_NAME} Cash-Flow Intelligence is included with MyMotiveLife Pro (${PLAN_PRICE_CAD}). Statement upload and manual entry — no bank connect required.`,
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

export default function CashFlowMarketingPage() {
  return (
    <>
      <KashuJsonLd />
      <KashuLandingPage />
    </>
  );
}
