import type { MarketingBrandId } from "./types";

export type BrandPublisherConfig = {
  metaAccessToken?: string;
  metaPageId?: string;
  instagramAccountId?: string;
  linkedinAccessToken?: string;
  linkedinOrgId?: string;
  defaultPostImageUrl?: string;
};

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function brandEnv(brandId: MarketingBrandId, suffix: string): string | undefined {
  const key = `MARKETING_${brandId.toUpperCase()}_${suffix}`;
  return env(key);
}

/** Per-brand social credentials with legacy global fallbacks for MotiveLife. */
export function getBrandPublisherConfig(brandId: MarketingBrandId): BrandPublisherConfig {
  const sharedMetaToken = env("MARKETING_META_ACCESS_TOKEN");
  const sharedLinkedInToken = env("MARKETING_LINKEDIN_ACCESS_TOKEN");

  return {
    metaAccessToken: brandEnv(brandId, "META_ACCESS_TOKEN") ?? sharedMetaToken,
    metaPageId:
      brandEnv(brandId, "META_PAGE_ID") ??
      (brandId === "motivelife" ? env("MARKETING_META_PAGE_ID") : undefined),
    instagramAccountId:
      brandEnv(brandId, "INSTAGRAM_ACCOUNT_ID") ??
      (brandId === "motivelife" ? env("MARKETING_INSTAGRAM_ACCOUNT_ID") : undefined),
    linkedinAccessToken:
      brandEnv(brandId, "LINKEDIN_ACCESS_TOKEN") ?? sharedLinkedInToken,
    linkedinOrgId:
      brandEnv(brandId, "LINKEDIN_ORG_ID") ??
      (brandId === "motivelife" ? env("MARKETING_LINKEDIN_ORG_ID") : undefined),
    defaultPostImageUrl:
      brandEnv(brandId, "POST_IMAGE_URL") ??
      (brandId === "motivelife" ? env("MARKETING_POST_IMAGE_URL") : undefined),
  };
}

export function isBrandChannelConfigured(
  brandId: MarketingBrandId,
  channel: "linkedin" | "instagram" | "facebook" | "tiktok" | "google_ads"
): boolean {
  const cfg = getBrandPublisherConfig(brandId);
  switch (channel) {
    case "linkedin":
      return Boolean(cfg.linkedinAccessToken && cfg.linkedinOrgId);
    case "facebook":
    case "instagram":
      return Boolean(cfg.metaAccessToken && cfg.metaPageId);
    case "tiktok":
      return Boolean(env("MARKETING_TIKTOK_ACCESS_TOKEN"));
    case "google_ads":
      return Boolean(env("MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN"));
    default:
      return false;
  }
}

export function missingBrandChannelEnv(
  brandId: MarketingBrandId,
  channel: "linkedin" | "instagram" | "facebook"
): string {
  const prefix = brandId === "motivelife" ? "MARKETING" : `MARKETING_${brandId.toUpperCase()}`;
  if (channel === "linkedin") {
    return `${prefix}_LINKEDIN_ACCESS_TOKEN + ${prefix}_LINKEDIN_ORG_ID`;
  }
  if (channel === "instagram") {
    return `${prefix}_META_ACCESS_TOKEN + ${prefix}_META_PAGE_ID + ${prefix}_INSTAGRAM_ACCOUNT_ID (or IG linked to Page)`;
  }
  return `${prefix}_META_ACCESS_TOKEN + ${prefix}_META_PAGE_ID`;
}

export function getBrandPublisherStatus(brandId: MarketingBrandId) {
  return {
    linkedin: isBrandChannelConfigured(brandId, "linkedin"),
    instagram: isBrandChannelConfigured(brandId, "instagram"),
    facebook: isBrandChannelConfigured(brandId, "facebook"),
    metaPageId: Boolean(getBrandPublisherConfig(brandId).metaPageId),
    instagramAccountId: Boolean(getBrandPublisherConfig(brandId).instagramAccountId),
  };
}

export function getAllBrandPublisherStatus() {
  return {
    motivelife: getBrandPublisherStatus("motivelife"),
    motivefx: getBrandPublisherStatus("motivefx"),
    motiveiq: getBrandPublisherStatus("motiveiq"),
  };
}
