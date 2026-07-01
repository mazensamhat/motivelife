import type { MarketingChannelId } from "./types";

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
    envKey: "MARKETING_TIKTOK_ACCESS_TOKEN",
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

export function isChannelConfigured(id: MarketingChannelId): boolean {
  const ch = getChannel(id);
  if (!ch.envKey) return false;
  return Boolean(process.env[ch.envKey]?.trim());
}
