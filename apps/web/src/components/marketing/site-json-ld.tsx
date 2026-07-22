import { PLAN_PRICE_CAD, TRIAL_DAYS } from "@/lib/marketing-copy";
import { MOTIVE_CORP_NAME, MOTIVE_CORP_SITE, PLAY_STORE_URL } from "@/lib/motive-family";
import { getSiteUrl } from "@/lib/site-url";

/** Machine-readable pricing so AI Overviews stop inventing "free forever" / invite-only. */
export function SiteJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "MotiveLife",
        url: siteUrl,
        logo: `${siteUrl}/icon-512.png`,
        sameAs: ["https://www.instagram.com/motivelife.ai/", PLAY_STORE_URL],
        parentOrganization: {
          "@type": "Organization",
          name: MOTIVE_CORP_NAME,
          url: MOTIVE_CORP_SITE,
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "support@mymotivelife.com",
          url: `${siteUrl}/support`,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#app`,
        name: "MotiveLife",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web, Android",
        url: siteUrl,
        downloadUrl: PLAY_STORE_URL,
        installUrl: PLAY_STORE_URL,
        description:
          "AI Life Operating System for calendar, money, health, goals, and habits. Available on Google Play; iOS coming soon. Wearable sync is optional.",
        offers: {
          "@type": "Offer",
          price: "14.99",
          priceCurrency: "CAD",
          availability: "https://schema.org/InStock",
          url: `${siteUrl}/register`,
          description: `${TRIAL_DAYS}-day free trial, then ${PLAN_PRICE_CAD}. Open web signup — no invite required. Fitbit / Apple Watch optional. Android on Google Play; iOS coming soon.`,
        },
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "How much does MotiveLife cost?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `MotiveLife Pro includes a ${TRIAL_DAYS}-day free trial, then ${PLAN_PRICE_CAD} until you cancel. Signup is open at mymotivelife.com/register — no Instagram invite required.`,
            },
          },
          {
            "@type": "Question",
            name: "Do I need a Fitbit or Apple Watch to use MotiveLife?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Wearables are optional. MotiveLife works from your goals, calendar, money, habits, and voice notes. Fitbit sync is available if you want it.",
            },
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
