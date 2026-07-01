export type MarketingBrandId = "motivelife" | "motivefx" | "motiveiq";

export type MarketingChannelId =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "google_search"
  | "google_ads";

export type MarketingContentKind = "social_post" | "seo_page" | "seo_blog" | "ad_copy";

export type MarketingPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type BrandProfile = {
  id: MarketingBrandId;
  name: string;
  siteUrl: string;
  tagline: string;
  audience: string;
  voice: string;
  trialOffer?: string;
  hashtags: string[];
};

export type GeneratedSocialPost = {
  channel: MarketingChannelId;
  body: string;
  hashtags: string[];
  ctaUrl: string;
  imagePrompt?: string;
};

export type GeneratedSeoContent = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  outline: string[];
  body: string;
  socialSnippets: GeneratedSocialPost[];
};

export type GenerateMarketingRequest = {
  brandId: MarketingBrandId;
  brief: string;
  channels: MarketingChannelId[];
  includeSeo?: boolean;
  includeAds?: boolean;
};

export type GenerateMarketingResult = {
  socialPosts: GeneratedSocialPost[];
  seo?: GeneratedSeoContent;
  adCopy?: string[];
};

export type PublishPayload = {
  brandId: MarketingBrandId;
  channel: MarketingChannelId;
  body: string;
  hashtags?: string[];
  ctaUrl?: string;
  title?: string;
  metaTitle?: string;
  metaDescription?: string;
};

export type PublishResult =
  | { ok: true; externalId: string; mode: "api" }
  | { ok: false; error: string; mode: "manual"; manualText: string };
