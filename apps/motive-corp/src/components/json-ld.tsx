import { CORP_SITE, PLATFORMS } from "@/lib/platforms";

export function OrganizationJsonLd() {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Motive-Corp",
    url: CORP_SITE,
    logo: `${CORP_SITE}/brand/motive-corp-logo.png`,
    description:
      "Motive-Corp builds AI platforms for better decisions — MotiveLife, MotiveIQ, MotiveFX, and MotivePulse IQ.",
    sameAs: PLATFORMS.map((p) => p.siteUrl),
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Motive-Corp platforms",
    itemListElement: PLATFORMS.map((platform, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "SoftwareApplication",
        name: platform.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: platform.siteUrl,
        description: platform.description,
        offers: {
          "@type": "Offer",
          url: platform.siteUrl,
          availability: "https://schema.org/InStock",
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
    </>
  );
}
