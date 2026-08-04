import type { Metadata } from "next";
import { Life360AlternativesPage } from "@/components/marketing/life360-alternatives-page";
import {
  LIFE360_ALT_META,
  LIFE360_ALT_PATH,
  LIFE360_ALT_REVIEWED,
} from "@/lib/life360-alternatives";
import { FAMILY_PRODUCT_NAME } from "@/lib/family-marketing";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: LIFE360_ALT_META.metaTitle,
  description: LIFE360_ALT_META.metaDescription,
  keywords: [...LIFE360_ALT_META.keywords],
  alternates: { canonical: LIFE360_ALT_PATH },
  openGraph: {
    title: LIFE360_ALT_META.metaTitle,
    description: LIFE360_ALT_META.metaDescription,
    url: `${getSiteUrl()}${LIFE360_ALT_PATH}`,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: LIFE360_ALT_META.metaTitle,
    description: LIFE360_ALT_META.metaDescription,
  },
};

function AlternativesJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: LIFE360_ALT_META.title,
    description: LIFE360_ALT_META.metaDescription,
    dateModified: "2026-08-04",
    author: {
      "@type": "Organization",
      name: "MyMotiveLife",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "MyMotiveLife",
      url: siteUrl,
    },
    mainEntityOfPage: `${siteUrl}${LIFE360_ALT_PATH}`,
    about: [
      { "@type": "Thing", name: "Life360 alternatives" },
      { "@type": "SoftwareApplication", name: FAMILY_PRODUCT_NAME },
    ],
    abstract: `Independent-style comparison of family location apps, published by MyMotiveLife. Last reviewed ${LIFE360_ALT_REVIEWED}.`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function Life360AlternativesRoute() {
  return (
    <>
      <AlternativesJsonLd />
      <Life360AlternativesPage />
    </>
  );
}
