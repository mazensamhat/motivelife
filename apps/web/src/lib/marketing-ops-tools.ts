/** Creative providers wired (or link-only) in MotiveLife Ops Marketing Agent. */

export type MarketingOpsToolCategory =
  | "ads"
  | "images"
  | "video"
  | "hashtags"
  | "copy";

export type MarketingOpsIntegration = "api" | "web";

export type MarketingOpsTool = {
  id: string;
  label: string;
  href: string;
  category: MarketingOpsToolCategory;
  blurb: string;
  /** How Ops connects — api means server-side key + generate path. */
  integration: MarketingOpsIntegration;
  /** Key on publisherStatus for API readiness. */
  statusKey?: string;
  /** Env vars required for API mode. */
  envHint?: string;
  /** Ops creative kind to POST when API-ready (optional). */
  creativeKind?: string;
  /** Image provider id for /creative when generating stills. */
  imageProvider?: string;
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
 * Prefer API-integrated providers. Web-only tools stay available as reference
 * (no public server API we can legally call from MotiveLife).
 */
export const MARKETING_OPS_FREE_TOOLS: MarketingOpsTool[] = [
  {
    id: "openai-image",
    label: "OpenAI Image",
    href: "https://platform.openai.com/docs/guides/images",
    category: "images",
    blurb: "gpt-image-1 via Ops Image button",
    integration: "api",
    statusKey: "openai",
    envHint: "OPENAI_API_KEY",
    creativeKind: "image",
    imageProvider: "openai",
  },
  {
    id: "gemini",
    label: "Gemini",
    href: "https://ai.google.dev/",
    category: "images",
    blurb: "Gemini image API via Ops Image provider",
    integration: "api",
    statusKey: "gemini",
    envHint: "GOOGLE_AI_API_KEY / GEMINI_API_KEY",
    creativeKind: "image",
    imageProvider: "gemini",
  },
  {
    id: "pollinations",
    label: "Pollinations",
    href: "https://pollinations.ai/",
    category: "images",
    blurb: "Free image API (always available in Ops)",
    integration: "api",
    statusKey: "pollinations",
    creativeKind: "image",
    imageProvider: "pollinations",
  },
  {
    id: "replicate",
    label: "Replicate",
    href: "https://replicate.com/",
    category: "video",
    blurb: "Simple short MP4 (image→video, no voice mux)",
    integration: "api",
    statusKey: "replicate",
    envHint: "REPLICATE_API_TOKEN",
    creativeKind: "video_5",
  },
  {
    id: "serper",
    label: "Serper tags",
    href: "https://serper.dev/",
    category: "hashtags",
    blurb: "Hashtag research on Generate drafts",
    integration: "api",
    statusKey: "serper",
    envHint: "SERPER_API_KEY",
  },
  {
    id: "chatgpt",
    label: "ChatGPT / GPT",
    href: "https://platform.openai.com/",
    category: "copy",
    blurb: "Copy + ads + narration via Ops Generate",
    integration: "api",
    statusKey: "openai",
    envHint: "OPENAI_API_KEY",
  },
  {
    id: "grok",
    label: "Grok (xAI)",
    href: "https://docs.x.ai/",
    category: "copy",
    blurb: "Optional copy model when XAI_API_KEY set",
    integration: "api",
    statusKey: "grok",
    envHint: "XAI_API_KEY or GROK_API_KEY",
  },
  // Web-only (no public server API for MotiveLife)
  {
    id: "canva",
    label: "Canva",
    href: "https://www.canva.com/",
    category: "images",
    blurb: "Web only — Canva Connect needs OAuth app review",
    integration: "web",
  },
  {
    id: "aireel",
    label: "AIReel",
    href: "https://www.aireel.net/",
    category: "video",
    blurb: "Web only — IG/FB Reels via text or image→video (no public API)",
    integration: "web",
  },
  {
    id: "capcut",
    label: "CapCut",
    href: "https://www.capcut.com/",
    category: "video",
    blurb: "Web/app only — no public creative API",
    integration: "web",
  },
  {
    id: "adamigo",
    label: "AdAmigo",
    href: "https://www.adamigo.ai/free-tools/free-ai-ad-generator",
    category: "ads",
    blurb: "Web free tool — no public Ops API",
    integration: "web",
  },
];

export const MARKETING_SCREENSHOTS_FOLDER =
  "https://www.mymotivelife.com/marketing/screenshots/";
