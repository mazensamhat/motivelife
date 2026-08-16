import { PLAN_PRICE_CAD, TRIAL_DAYS } from "@/lib/marketing-copy";
import {
  FAMILY_MEMBER_PRO_UPGRADE_CAD,
  FAMILY_PRICE_CAD,
  FAMILY_PRODUCT_NAME,
} from "@/lib/family-marketing";
import {
  KASHU_META_DESCRIPTION,
  KASHU_PAGE_PATH,
  KASHU_PRODUCT_NAME,
  KASHU_TAGLINE,
} from "@/lib/kashu-marketing";
import {
  APP_STORE_URL,
  MOTIVE_CORP_NAME,
  MOTIVE_CORP_SITE,
  PLAY_STORE_URL,
} from "@/lib/motive-family";
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
        sameAs: [
          "https://www.instagram.com/motivelife.ai/",
          APP_STORE_URL,
          PLAY_STORE_URL,
        ],
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
        operatingSystem: "Web, iOS, Android",
        url: siteUrl,
        downloadUrl: APP_STORE_URL,
        installUrl: APP_STORE_URL,
        description:
          "AI Life Operating System — DayO, LifeVue, UPLIFT, Kashu (Cash-Flow Intelligence / Safe to Spend), and VYRA for you; KINZO AI for your family. Available on the App Store and Google Play.",
        offers: [
          {
            "@type": "Offer",
            name: "MyMotiveLife Pro",
            price: "14.99",
            priceCurrency: "CAD",
            availability: "https://schema.org/InStock",
            url: `${siteUrl}/register`,
            description: `${TRIAL_DAYS}-day free trial, then ${PLAN_PRICE_CAD}. Build My Digital Twin on the web — no invite required. Fitbit / Apple Watch optional. Available on the App Store and Google Play.`,
          },
          {
            "@type": "Offer",
            name: FAMILY_PRODUCT_NAME,
            price: FAMILY_PRICE_CAD.toFixed(2),
            priceCurrency: "CAD",
            availability: "https://schema.org/InStock",
            url: `${siteUrl}/family`,
            description: `${FAMILY_PRODUCT_NAME} — family map and household intelligence at $${FAMILY_PRICE_CAD.toFixed(2)} CAD/month, including MyMotiveLife Pro for the account owner. Active members can unlock full private Pro for $${FAMILY_MEMBER_PRO_UPGRADE_CAD.toFixed(2)} CAD/month.`,
          },
          {
            "@type": "Offer",
            name: "Family Pro Upgrade",
            price: FAMILY_MEMBER_PRO_UPGRADE_CAD.toFixed(2),
            priceCurrency: "CAD",
            availability: "https://schema.org/InStock",
            url: `${siteUrl}/family`,
            description: `Full private MyMotiveLife Pro for active KINZO AI household members at $${FAMILY_MEMBER_PRO_UPGRADE_CAD.toFixed(2)} CAD/month (household discount vs ${PLAN_PRICE_CAD}).`,
          },
        ],
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
              text: `MyMotiveLife Pro includes a ${TRIAL_DAYS}-day free trial, then ${PLAN_PRICE_CAD} until you cancel. KINZO AI is $${FAMILY_PRICE_CAD.toFixed(2)} CAD/month for a household (includes Life Pro for the owner; Family for invited members is included). Active Family members can unlock full private Pro for $${FAMILY_MEMBER_PRO_UPGRADE_CAD.toFixed(2)} CAD/month. Signup is open at mymotivelife.com/register.`,
            },
          },
          {
            "@type": "Question",
            name: "What is KINZO AI?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `${FAMILY_PRODUCT_NAME} is the family map for your household — $${FAMILY_PRICE_CAD.toFixed(2)} CAD/month, including Life Pro for the owner. Active members can unlock full private Pro for $${FAMILY_MEMBER_PRO_UPGRADE_CAD.toFixed(2)} CAD/month. Learn more at mymotivelife.com/family.`,
            },
          },
          {
            "@type": "Question",
            name: "What is Kashu?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `${KASHU_PRODUCT_NAME} is Cash-Flow Intelligence inside MyMotiveLife. ${KASHU_TAGLINE} ${KASHU_META_DESCRIPTION} Included with MyMotiveLife Pro (${PLAN_PRICE_CAD}). No bank connect required. Learn more at mymotivelife.com${KASHU_PAGE_PATH}.`,
            },
          },
          {
            "@type": "Question",
            name: "Does Kashu connect to my bank?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Kashu learns from statement uploads (PDF/CSV/paste) and manual balance, payday, and bill entry. Bank aggregation is not required.",
            },
          },
          {
            "@type": "Question",
            name: "What products are in the MotiveLife suite?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "DayO (your day), LifeVue (life in one view), KINZO AI (family intelligence), UPLIFT (goals), Kashu (Cash-Flow Intelligence / Safe to Spend), and VYRA AI (Chief of Staff). Kashu is included with MyMotiveLife Pro. KINZO is a household plan at mymotivelife.com/family.",
            },
          },
          {
            "@type": "Question",
            name: "Do I need a Fitbit or Apple Watch to use MotiveLife?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Wearables are optional. MotiveLife works from your goals, calendar, money (Kashu), habits, and voice notes. Fitbit sync is available if you want it.",
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
