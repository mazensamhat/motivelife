import { getAppUrl } from "@/lib/stripe";

export type SocialPlatformId = "instagram" | "facebook" | "tiktok" | "linkedin";

export type SocialPlatformConfig = {
  id: SocialPlatformId;
  label: string;
  utmSource: SocialPlatformId;
  profileUrl: string | null;
  trackingUrl: string;
};

const PLATFORMS: Array<{
  id: SocialPlatformId;
  label: string;
  envKey: string;
}> = [
  { id: "instagram", label: "Instagram", envKey: "SOCIAL_INSTAGRAM_URL" },
  { id: "facebook", label: "Facebook", envKey: "SOCIAL_FACEBOOK_URL" },
  { id: "tiktok", label: "TikTok", envKey: "SOCIAL_TIKTOK_URL" },
  { id: "linkedin", label: "LinkedIn", envKey: "SOCIAL_LINKEDIN_URL" },
];

export function buildTrackingUrl(utmSource: string, medium = "social") {
  const base = getAppUrl().replace(/\/$/, "");
  const params = new URLSearchParams({
    utm_source: utmSource,
    utm_medium: medium,
    utm_campaign: "mymotivelife",
  });
  return `${base}/?${params.toString()}`;
}

export function getSocialPlatforms(): SocialPlatformConfig[] {
  return PLATFORMS.map((p) => {
    const profileUrl = process.env[p.envKey]?.trim() || null;
    return {
      id: p.id,
      label: p.label,
      utmSource: p.id,
      profileUrl,
      trackingUrl: buildTrackingUrl(p.id),
    };
  });
}

/** Classify traffic source from UTM or referrer host. */
export function normalizeTrafficSource(referrer: string | null, utmSource: string | null): string {
  if (utmSource?.trim()) return utmSource.trim().toLowerCase();

  if (!referrer?.trim()) return "direct";

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("instagram")) return "instagram";
    if (host.includes("facebook") || host.includes("fb.com") || host === "fb.me") return "facebook";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("linkedin")) return "linkedin";
    if (host.includes("google")) return "google";
    if (host.includes("bing")) return "bing";
    return host;
  } catch {
    return "direct";
  }
}

export const SOCIAL_PLATFORM_IDS = PLATFORMS.map((p) => p.id);
