/** Motive-Corp family sites + store links (client-safe). */

export const MOTIVE_CORP_SITE = "https://www.motive-corp.com";
export const MOTIVE_CORP_NAME = "Motive-Corp";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mymotivelife.app";

export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() ||
  "https://apps.apple.com/us/app/motivelife-ai/id6789397267";

export type MotiveFamilyBrand = {
  id: string;
  name: string;
  tagline: string;
  href: string;
};

/** Sister platforms under Motive-Corp (external sites). */
export const MOTIVE_FAMILY_BRANDS: MotiveFamilyBrand[] = [
  {
    id: "motivefx",
    name: "MotiveFX",
    tagline: "Trade smarter. Move faster.",
    href: "https://www.motivefxai.com",
  },
  {
    id: "motiveiq",
    name: "MotiveIQ",
    tagline: "Secret project",
    href: "https://www.motive-corp.com/platforms",
  },
  {
    id: "motivepulse",
    name: "MotivePulse IQ",
    tagline: "Insights. Automation. Growth.",
    href: "https://www.mymotivepulse.com",
  },
];
