import type { MarketingBrandId, MarketingChannelId } from "./types";
import {
  isBufferConfigured,
  isUnifiedPublishConfigured,
  isZernioConfigured,
} from "./unified-publish";
import {
  isNativeYouTubeConfigured,
  resolveYouTubeChannelId,
  resolveYouTubeRefreshToken,
} from "./youtube";

export type BrandPublisherConfig = {
  metaAccessToken?: string;
  metaPageId?: string;
  instagramAccountId?: string;
  linkedinAccessToken?: string;
  linkedinOrgId?: string;
  defaultPostImageUrl?: string;
  redditClientId?: string;
  redditClientSecret?: string;
  redditUsername?: string;
  redditPassword?: string;
  redditRefreshToken?: string;
  redditSubreddit?: string;
  redditUserAgent?: string;
  bufferApiKey?: string;
  zernioApiKey?: string;
  youtubeRefreshToken?: string;
  youtubeChannelId?: string;
};

export type BrandSocialChannel =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "reddit"
  | "x"
  | "threads"
  | "youtube"
  | "google_ads";

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
    redditClientId:
      brandEnv(brandId, "REDDIT_CLIENT_ID") ?? env("MARKETING_REDDIT_CLIENT_ID"),
    redditClientSecret:
      brandEnv(brandId, "REDDIT_CLIENT_SECRET") ?? env("MARKETING_REDDIT_CLIENT_SECRET"),
    redditUsername:
      brandEnv(brandId, "REDDIT_USERNAME") ?? env("MARKETING_REDDIT_USERNAME"),
    redditPassword:
      brandEnv(brandId, "REDDIT_PASSWORD") ?? env("MARKETING_REDDIT_PASSWORD"),
    redditRefreshToken:
      brandEnv(brandId, "REDDIT_REFRESH_TOKEN") ?? env("MARKETING_REDDIT_REFRESH_TOKEN"),
    redditSubreddit:
      brandEnv(brandId, "REDDIT_SUBREDDIT") ?? env("MARKETING_REDDIT_SUBREDDIT"),
    redditUserAgent:
      brandEnv(brandId, "REDDIT_USER_AGENT") ?? env("MARKETING_REDDIT_USER_AGENT"),
    bufferApiKey: brandEnv(brandId, "BUFFER_API_KEY") ?? env("MARKETING_BUFFER_API_KEY"),
    zernioApiKey: brandEnv(brandId, "ZERNIO_API_KEY") ?? env("MARKETING_ZERNIO_API_KEY"),
    youtubeRefreshToken: resolveYouTubeRefreshToken(brandId),
    youtubeChannelId: resolveYouTubeChannelId(brandId),
  };
}

function nativeBrandChannelConfigured(
  brandId: MarketingBrandId,
  channel: BrandSocialChannel
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
    case "reddit":
      return Boolean(
        cfg.redditClientId &&
          cfg.redditClientSecret &&
          cfg.redditUsername &&
          cfg.redditSubreddit &&
          (cfg.redditRefreshToken || cfg.redditPassword)
      );
    case "x":
    case "threads":
      return false;
    case "youtube":
      return isNativeYouTubeConfigured(brandId);
    case "google_ads":
      return Boolean(env("MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN"));
    default:
      return false;
  }
}

export function isBrandChannelConfigured(
  brandId: MarketingBrandId,
  channel: BrandSocialChannel
): boolean {
  if (
    channel !== "google_ads" &&
    isUnifiedPublishConfigured(brandId, channel as MarketingChannelId)
  ) {
    return true;
  }
  return nativeBrandChannelConfigured(brandId, channel);
}

export function missingBrandChannelEnv(
  brandId: MarketingBrandId,
  channel: "linkedin" | "instagram" | "facebook" | "reddit" | "youtube" | "unified"
): string {
  const prefix = brandId === "motivelife" ? "MARKETING" : `MARKETING_${brandId.toUpperCase()}`;
  if (channel === "unified") {
    return `${prefix}_BUFFER_API_KEY + ${prefix}_BUFFER_CHANNEL_* or ${prefix}_ZERNIO_API_KEY + ${prefix}_ZERNIO_ACCOUNT_*`;
  }
  if (channel === "youtube") {
    return `${prefix}_YOUTUBE_REFRESH_TOKEN + ${prefix}_YOUTUBE_CHANNEL_ID + MARKETING_YOUTUBE_CLIENT_ID/SECRET (or GOOGLE_CLIENT_*)`;
  }
  if (channel === "linkedin") {
    return `${prefix}_LINKEDIN_ACCESS_TOKEN + ${prefix}_LINKEDIN_ORG_ID (or Buffer/Zernio)`;
  }
  if (channel === "instagram") {
    return `${prefix}_META_* (or Buffer/Zernio)`;
  }
  if (channel === "reddit") {
    return `${prefix}_REDDIT_* or Buffer/Zernio account mapping`;
  }
  return `${prefix}_META_* (or Buffer/Zernio)`;
}

export function getBrandPublisherStatus(brandId: MarketingBrandId) {
  const cfg = getBrandPublisherConfig(brandId);
  return {
    linkedin: isBrandChannelConfigured(brandId, "linkedin"),
    instagram: isBrandChannelConfigured(brandId, "instagram"),
    facebook: isBrandChannelConfigured(brandId, "facebook"),
    tiktok: isBrandChannelConfigured(brandId, "tiktok"),
    reddit: isBrandChannelConfigured(brandId, "reddit"),
    x: isBrandChannelConfigured(brandId, "x"),
    threads: isBrandChannelConfigured(brandId, "threads"),
    youtube: isBrandChannelConfigured(brandId, "youtube"),
    buffer: isBufferConfigured(brandId),
    zernio: isZernioConfigured(brandId),
    metaPageId: Boolean(cfg.metaPageId),
    instagramAccountId: Boolean(cfg.instagramAccountId),
    youtubeChannelId: Boolean(cfg.youtubeChannelId),
  };
}

export function getAllBrandPublisherStatus() {
  return {
    motivelife: getBrandPublisherStatus("motivelife"),
    motivefx: getBrandPublisherStatus("motivefx"),
    motiveiq: getBrandPublisherStatus("motiveiq"),
    motivepulse: getBrandPublisherStatus("motivepulse"),
  };
}
