/** Free / freemium creative tools surfaced in MotiveLife Ops Marketing Agent. */

export type MarketingOpsToolCategory =
  | "ads"
  | "images"
  | "video"
  | "hashtags"
  | "copy";

export type MarketingOpsTool = {
  id: string;
  label: string;
  href: string;
  category: MarketingOpsToolCategory;
  blurb: string;
};

export const MARKETING_OPS_TOOL_CATEGORIES: {
  id: MarketingOpsToolCategory;
  label: string;
}[] = [
  { id: "ads", label: "Ad creatives" },
  { id: "images", label: "Images" },
  { id: "video", label: "Video" },
  { id: "hashtags", label: "Hashtags" },
  { id: "copy", label: "Copy" },
];

/**
 * Curated free / freemium stack — open in a new tab, then ship from Ops.
 * Prefer product UI screenshots from /marketing/screenshots as inputs.
 */
export const MARKETING_OPS_FREE_TOOLS: MarketingOpsTool[] = [
  {
    id: "sivi",
    label: "Sivi",
    href: "https://sivi.ai/generate-ads",
    category: "ads",
    blurb: "Editable ad sizes · free monthly credits",
  },
  {
    id: "adamigo",
    label: "AdAmigo",
    href: "https://www.adamigo.ai/free-tools/free-ai-ad-generator",
    category: "ads",
    blurb: "Product photo → Meta-ready ads",
  },
  {
    id: "cliptics",
    label: "Cliptics",
    href: "https://cliptics.com/ai-ad-creative-generator",
    category: "ads",
    blurb: "Free platform-sized ad creatives",
  },
  {
    id: "scribed",
    label: "Scribed Ads",
    href: "https://www.scribed.ai/ads",
    category: "ads",
    blurb: "Screenshot → ads · no watermark tier",
  },
  {
    id: "canva",
    label: "Canva",
    href: "https://www.canva.com/",
    category: "images",
    blurb: "Design + Magic Media · brand kits",
  },
  {
    id: "pollinations",
    label: "Pollinations",
    href: "https://pollinations.ai/",
    category: "images",
    blurb: "Free image gen (also in Ops Image)",
  },
  {
    id: "gemini-image",
    label: "Gemini",
    href: "https://gemini.google.com/",
    category: "images",
    blurb: "Image + multimodal ideas",
  },
  {
    id: "capcut",
    label: "CapCut",
    href: "https://www.capcut.com/",
    category: "video",
    blurb: "Reels / TikTok cutdowns",
  },
  {
    id: "kenerate",
    label: "Kenerate",
    href: "https://kenerateai.com/ai-ads-generator",
    category: "video",
    blurb: "UGC-style ad video credits",
  },
  {
    id: "canva-tags",
    label: "Canva tags",
    href: "https://www.canva.com/features/tiktok-hashtag-generator/",
    category: "hashtags",
    blurb: "TikTok / social tag ideas",
  },
  {
    id: "free-ai-tags",
    label: "Free.ai tags",
    href: "https://free.ai/text/hashtag-generator/",
    category: "hashtags",
    blurb: "Per-platform hashtag sets",
  },
  {
    id: "socialcal",
    label: "SocialCal",
    href: "https://www.socialcal.app/hashtag-generator",
    category: "hashtags",
    blurb: "IG / TikTok / X / LI rules",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    href: "https://chatgpt.com/",
    category: "copy",
    blurb: "Hooks, RSA, scripts",
  },
  {
    id: "grok",
    label: "Grok",
    href: "https://grok.x.ai/",
    category: "copy",
    blurb: "Alt angles / X-native tone",
  },
];

export const MARKETING_SCREENSHOTS_URL =
  "https://www.mymotivelife.com/marketing/screenshots/phone-01-today.png";

export const MARKETING_SCREENSHOTS_FOLDER =
  "https://www.mymotivelife.com/marketing/screenshots/";
