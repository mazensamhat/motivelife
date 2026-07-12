import type { BrandProfile, MarketingBrandId } from "./types";

export const BRAND_PROFILES: Record<MarketingBrandId, BrandProfile> = {
  motivelife: {
    id: "motivelife",
    name: "MotiveLife",
    siteUrl: "https://www.mymotivelife.com",
    tagline: "Just talk. Your AI life operating system.",
    audience:
      "Adults 20–45 building career, money, health, and habits — overwhelmed by fragmented apps and generic AI chat.",
    voice:
      "Clear, warm, direct. Action over information. No hype, no fear, no emoji spam. Canadian-built, privacy-first.",
    trialOffer: "14-day free Pro trial — no credit card to start.",
    hashtags: ["MotiveLife", "LifeOS", "AIcoach", "Productivity", "Canada"],
  },
  motivefx: {
    id: "motivefx",
    name: "MotiveFX",
    siteUrl: "https://www.motivefxai.com",
    tagline: "Trade smarter. Move faster. AI command center for market intelligence.",
    audience:
      "Active traders and investors who want AI-ranked signals, portfolio context, and faster decisions across stocks, crypto, sports betting, and Polymarket-style prediction markets.",
    voice:
      "Confident, data-forward, trader-native. Speak like a terminal for markets — signals, flow, edge, risk. Never automotive or dealership language.",
    trialOffer: "Start your free trial — AI-ranked market signals in one terminal.",
    hashtags: ["MotiveFX", "Trading", "Crypto", "Stocks", "MarketIntel", "Polymarket"],
  },
  motiveiq: {
    id: "motiveiq",
    name: "MotiveIQ",
    siteUrl: "https://www.motiveiqs.com/gate",
    tagline: "AI Growth — dealer intelligence for automotive dealerships.",
    audience:
      "Automotive dealers and dealership operators who want AI-powered growth across sales, ops, and customer pipelines.",
    voice:
      "Operator-focused, dealer-native, results-first. Speak like a growth partner for dealerships — inventory, F&I, service, pipelines. Never consumer car-buying language.",
    hashtags: ["MotiveIQ", "DealerGrowth", "AutomotiveDealers", "DealershipOps"],
  },
  motivepulse: {
    id: "motivepulse",
    name: "MotivePulse IQ",
    siteUrl: "https://www.mymotivepulse.com",
    tagline: "Insights. Automation. Growth.",
    audience:
      "Local and multi-location business owners who need Google reviews, reputation, and growth automation without hiring a marketing team.",
    voice:
      "Clear, operator-focused, results-first. Speak like a growth partner for real businesses — reviews, replies, score, competitors. Gold-premium brand energy, never life-coaching or trading jargon.",
    trialOffer: "Get your free Motive Score — see where you stand in under 2 minutes.",
    hashtags: [
      "MotivePulseIQ",
      "GoogleReviews",
      "ReputationManagement",
      "LocalBusiness",
      "BusinessGrowth",
    ],
  },
};

export function getBrandProfile(brandId: MarketingBrandId): BrandProfile {
  return BRAND_PROFILES[brandId];
}

export function buildTrackingUrl(brandId: MarketingBrandId, channel: string) {
  const base = BRAND_PROFILES[brandId].siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    utm_source: channel,
    utm_medium: channel === "google_search" || channel === "google_ads" ? "cpc" : "social",
    utm_campaign: brandId,
  });
  return `${base}/?${params.toString()}`;
}
