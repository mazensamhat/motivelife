/** Human labels + entry presets for Ops cost ledger. */

export const OPS_COST_CATEGORY_LABELS: Record<string, string> = {
  openai: "OpenAI",
  vercel: "Vercel hosting",
  vercel_blob: "Vercel Blob",
  supabase: "Supabase",
  stripe_fees: "Stripe fees",
  resend: "Resend email",
  twilio: "Twilio SMS/voice",
  google_ai: "Google AI / Gemini",
  replicate: "Replicate",
  serper: "Serper",
  xai: "xAI / Grok",
  cloudflare: "Cloudflare",
  buffer: "Buffer",
  zernio: "Zernio",
  marketing_ads: "Marketing ads (other)",
  marketing_boosts: "Marketing boosts (general)",
  youtube_boost: "YouTube boosting",
  instagram_boost: "Instagram boosting",
  facebook_boost: "Facebook boosting",
  linkedin_boost: "LinkedIn boosting",
  tiktok_boost: "TikTok boosting",
  marketing_scm: "SCM (social / content marketing)",
  marketing_sco: "SCO / SEM / Google Ads",
  revenuecat: "RevenueCat",
  apple_store: "Apple Developer / Store",
  google_play: "Google Play",
  eas: "Expo EAS",
  domains: "Domains / DNS",
  network: "Network / infra",
  other: "Other",
};

export type CostPreset = {
  id: string;
  label: string;
  category: string;
  vendor: string;
  description: string;
  group: "marketing" | "infra" | "ai" | "communications" | "mobile";
};

/** One-click manual entry starters covering connected + common vendors. */
export const COST_PRESETS: CostPreset[] = [
  // Marketing
  {
    id: "yt",
    label: "YouTube boost",
    category: "youtube_boost",
    vendor: "YouTube",
    description: "YouTube promotion / boost",
    group: "marketing",
  },
  {
    id: "ig",
    label: "Instagram boost",
    category: "instagram_boost",
    vendor: "Meta / Instagram",
    description: "Instagram boost",
    group: "marketing",
  },
  {
    id: "fb",
    label: "Facebook boost",
    category: "facebook_boost",
    vendor: "Meta / Facebook",
    description: "Facebook boost",
    group: "marketing",
  },
  {
    id: "li",
    label: "LinkedIn boost",
    category: "linkedin_boost",
    vendor: "LinkedIn",
    description: "LinkedIn boost / sponsored",
    group: "marketing",
  },
  {
    id: "tt",
    label: "TikTok boost",
    category: "tiktok_boost",
    vendor: "TikTok",
    description: "TikTok ads / boost",
    group: "marketing",
  },
  {
    id: "gads",
    label: "Google Ads",
    category: "marketing_sco",
    vendor: "Google Ads",
    description: "Google Ads / SEM spend",
    group: "marketing",
  },
  {
    id: "scm",
    label: "SCM",
    category: "marketing_scm",
    vendor: "",
    description: "Social / content marketing",
    group: "marketing",
  },
  {
    id: "ads",
    label: "Other ads",
    category: "marketing_ads",
    vendor: "",
    description: "Paid ads",
    group: "marketing",
  },
  {
    id: "buffer",
    label: "Buffer plan",
    category: "buffer",
    vendor: "Buffer",
    description: "Buffer subscription",
    group: "marketing",
  },
  {
    id: "zernio",
    label: "Zernio plan",
    category: "zernio",
    vendor: "Zernio",
    description: "Zernio subscription",
    group: "marketing",
  },
  // Infra
  {
    id: "vercel",
    label: "Vercel invoice",
    category: "vercel",
    vendor: "Vercel",
    description: "Vercel hosting invoice",
    group: "infra",
  },
  {
    id: "blob",
    label: "Vercel Blob",
    category: "vercel_blob",
    vendor: "Vercel",
    description: "Blob storage",
    group: "infra",
  },
  {
    id: "supabase",
    label: "Supabase invoice",
    category: "supabase",
    vendor: "Supabase",
    description: "Supabase plan / overage",
    group: "infra",
  },
  {
    id: "domains",
    label: "Domain / DNS",
    category: "domains",
    vendor: "Network Solutions",
    description: "Domain renewal / DNS",
    group: "infra",
  },
  {
    id: "cf",
    label: "Cloudflare",
    category: "cloudflare",
    vendor: "Cloudflare",
    description: "Cloudflare plan",
    group: "infra",
  },
  // AI
  {
    id: "openai-manual",
    label: "OpenAI top-up",
    category: "openai",
    vendor: "OpenAI",
    description: "OpenAI usage not covered by auto sync",
    group: "ai",
  },
  {
    id: "gemini",
    label: "Gemini / Google AI",
    category: "google_ai",
    vendor: "Google AI",
    description: "Gemini image / API usage",
    group: "ai",
  },
  {
    id: "replicate",
    label: "Replicate",
    category: "replicate",
    vendor: "Replicate",
    description: "Replicate video / mux",
    group: "ai",
  },
  {
    id: "serper",
    label: "Serper",
    category: "serper",
    vendor: "Serper",
    description: "Serper search credits",
    group: "ai",
  },
  // Communications
  {
    id: "resend",
    label: "Resend",
    category: "resend",
    vendor: "Resend",
    description: "Resend email invoice",
    group: "communications",
  },
  {
    id: "twilio",
    label: "Twilio",
    category: "twilio",
    vendor: "Twilio",
    description: "Twilio SMS / voice",
    group: "communications",
  },
  // Mobile
  {
    id: "rc",
    label: "RevenueCat",
    category: "revenuecat",
    vendor: "RevenueCat",
    description: "RevenueCat plan",
    group: "mobile",
  },
  {
    id: "apple",
    label: "Apple Developer",
    category: "apple_store",
    vendor: "Apple",
    description: "Apple Developer / fees",
    group: "mobile",
  },
  {
    id: "play",
    label: "Google Play",
    category: "google_play",
    vendor: "Google Play",
    description: "Play Console / fees",
    group: "mobile",
  },
  {
    id: "eas",
    label: "Expo EAS",
    category: "eas",
    vendor: "Expo",
    description: "EAS build minutes",
    group: "mobile",
  },
];

/** @deprecated use COST_PRESETS */
export const MARKETING_COST_PRESETS = COST_PRESETS.filter((p) => p.group === "marketing");

export function categoryLabel(category: string): string {
  return OPS_COST_CATEGORY_LABELS[category] ?? category;
}

export function daysInMonthKey(yyyyMm: string): number {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function dailyFromMonthly(amountCad: number, days: number): number {
  if (days <= 0) return 0;
  return Math.round((amountCad / days) * 100) / 100;
}
