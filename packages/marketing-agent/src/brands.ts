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
    siteUrl: "https://motiveiq.ai",
    tagline: "Consumer automotive intelligence — buy and own with confidence.",
    audience: "Car buyers and owners who want fair deals, maintenance clarity, and less dealer anxiety.",
    voice: "Trustworthy, consumer-advocate, plain language. Empowering, not salesy.",
    hashtags: ["MotiveIQ", "CarBuying", "AutoAdvice"],
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
