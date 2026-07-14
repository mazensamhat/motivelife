import type { MarketingChannelId } from "./types";
import { isUnifiedPublishConfigured } from "./unified-publish";

export type ChannelDefinition = {
  id: MarketingChannelId;
  label: string;
  maxLength: number;
  supportsAutoPublish: boolean;
  envKey?: string;
};

export const MARKETING_CHANNELS: ChannelDefinition[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    maxLength: 3000,
    supportsAutoPublish: true,
    envKey: "MARKETING_LINKEDIN_ACCESS_TOKEN",
  },
  {
    id: "instagram",
    label: "Instagram",
    maxLength: 2200,
    supportsAutoPublish: true,
    envKey: "MARKETING_META_ACCESS_TOKEN",
  },
  {
    id: "facebook",
    label: "Facebook",
    maxLength: 63206,
    supportsAutoPublish: true,
    envKey: "MARKETING_META_ACCESS_TOKEN",
  },
  {
    id: "tiktok",
    label: "TikTok",
    maxLength: 2200,
    supportsAutoPublish: true,
    envKey: "MARKETING_BUFFER_API_KEY",
  },
  {
    id: "reddit",
    label: "Reddit",
    maxLength: 40000,
    supportsAutoPublish: true,
    envKey: "MARKETING_ZERNIO_API_KEY",
  },
  {
    id: "x",
    label: "X (Twitter)",
    maxLength: 280,
    supportsAutoPublish: true,
    envKey: "MARKETING_BUFFER_API_KEY",
  },
  {
    id: "threads",
    label: "Threads",
    maxLength: 500,
    supportsAutoPublish: true,
    envKey: "MARKETING_BUFFER_API_KEY",
  },
  {
    id: "youtube",
    label: "YouTube",
    maxLength: 5000,
    supportsAutoPublish: true,
    envKey: "MARKETING_ZERNIO_API_KEY",
  },
  {
    id: "google_search",
    label: "Google Search / SEO",
    maxLength: 50000,
    supportsAutoPublish: false,
  },
  {
    id: "google_ads",
    label: "Google Ads",
    maxLength: 900,
    supportsAutoPublish: true,
    envKey: "MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN",
  },
];

export function getChannel(id: MarketingChannelId): ChannelDefinition {
  const ch = MARKETING_CHANNELS.find((c) => c.id === id);
  if (!ch) throw new Error(`Unknown channel: ${id}`);
  return ch;
}

function nativeChannelConfigured(id: MarketingChannelId): boolean {
  switch (id) {
    case "linkedin":
      return Boolean(
        process.env.MARKETING_LINKEDIN_ACCESS_TOKEN?.trim() &&
          process.env.MARKETING_LINKEDIN_ORG_ID?.trim()
      );
    case "facebook":
    case "instagram":
      return Boolean(
        process.env.MARKETING_META_ACCESS_TOKEN?.trim() &&
          process.env.MARKETING_META_PAGE_ID?.trim()
      );
    case "tiktok":
      return Boolean(process.env.MARKETING_TIKTOK_ACCESS_TOKEN?.trim());
    case "reddit": {
      const clientId = process.env.MARKETING_REDDIT_CLIENT_ID?.trim();
      const secret = process.env.MARKETING_REDDIT_CLIENT_SECRET?.trim();
      const username = process.env.MARKETING_REDDIT_USERNAME?.trim();
      const subreddit = process.env.MARKETING_REDDIT_SUBREDDIT?.trim();
      const refresh = process.env.MARKETING_REDDIT_REFRESH_TOKEN?.trim();
      const password = process.env.MARKETING_REDDIT_PASSWORD?.trim();
      return Boolean(
        clientId && secret && username && subreddit && (refresh || password)
      );
    }
    case "google_ads":
      return Boolean(process.env.MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN?.trim());
    case "x":
    case "threads":
    case "youtube":
      return false;
    default:
      return false;
  }
}

export function isChannelConfigured(id: MarketingChannelId): boolean {
  if (id === "google_search") return true;
  if (id !== "google_ads" && isUnifiedPublishConfigured("motivelife", id)) {
    return true;
  }
  return nativeChannelConfigured(id);
}
