export type MarketingBrandId = "motivelife" | "motivefx" | "motiveiq" | "motivepulse";

export type MarketingChannelId =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "reddit"
  | "x"
  | "threads"
  | "youtube"
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
  /** Reddit (and similar) post title — max ~300 chars. */
  title?: string;
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
  generateMedia?: boolean;
  mediaKind?: "image" | "video_5" | "video_30" | "animation" | "predis_image" | "predis_carousel" | "predis_video";
  /** App screenshot pasted at generate time — vision copy + AI re-imagine for creatives. */
  referenceImage?: {
    base64: string;
    mimeType: string;
  };
  /** How to transform the reference screenshot into post art. */
  referenceImageMode?: "reimagine" | "polish";
  /** Override MARKETING_IMAGE_PROVIDER for this run. */
  imageProvider?:
    | "auto"
    | "gemini"
    | "openai"
    | "browser"
    | "pollinations"
    | "cloudflare"
    | "puter";
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
  mediaUrl?: string;
  mediaType?: "image" | "gif" | "video";
  /** ISO schedule time for Buffer/Zernio. When set, post is scheduled not immediate. */
  scheduleDate?: string;
};

export type PublishResult =
  | { ok: true; externalId: string; mode: "api" }
  | { ok: false; error: string; mode: "manual"; manualText: string };
