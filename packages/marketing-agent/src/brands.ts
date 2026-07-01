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
    siteUrl: "https://motivefx.ai",
    tagline: "AI operations for automotive and dealership teams.",
    audience: "Dealers, GMs, and ops leaders who need clarity across inventory, leads, and team performance.",
    voice: "Professional, data-driven, dealership-native. ROI-focused, no fluff.",
    hashtags: ["MotiveFX", "Automotive", "Dealership", "AIops"],
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
