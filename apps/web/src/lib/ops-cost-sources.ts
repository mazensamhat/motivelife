/**
 * Registry of every billable / potentially billable vendor connected to MotiveLife Ops.
 * Used for the Admin cost-sources matrix (auto vs manual vs not configured).
 */

export type CostTrackMode = "auto" | "manual" | "none";

export type OpsCostSourceDef = {
  id: string;
  name: string;
  group: "infra" | "ai" | "communications" | "marketing" | "mobile" | "other";
  /** Prisma OpsCostCategory value */
  category: string;
  trackMode: CostTrackMode;
  trackNote: string;
  billingUrl: string | null;
  /** Env keys that indicate this vendor is wired in production */
  envKeys: string[];
};

function envSet(...keys: string[]): boolean {
  return keys.some((k) => Boolean(process.env[k]?.trim()));
}

export const OPS_COST_SOURCE_DEFS: OpsCostSourceDef[] = [
  // ── Infra ──────────────────────────────────────────────────────────────
  {
    id: "vercel",
    name: "Vercel (hosting / cron)",
    group: "infra",
    category: "vercel",
    trackMode: "manual",
    trackNote: "Enter invoice total each month (no reliable usage $ API key).",
    billingUrl: "https://vercel.com/account/billing",
    envKeys: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
  },
  {
    id: "vercel_blob",
    name: "Vercel Blob",
    group: "infra",
    category: "vercel_blob",
    trackMode: "manual",
    trackNote: "Storage for marketing media / resumes — enter from Vercel invoice line.",
    billingUrl: "https://vercel.com/account/billing",
    envKeys: ["BLOB_READ_WRITE_TOKEN"],
  },
  {
    id: "supabase",
    name: "Supabase (Postgres)",
    group: "infra",
    category: "supabase",
    trackMode: "manual",
    trackNote: "Enter plan / overage from Supabase billing.",
    billingUrl: "https://supabase.com/dashboard/project/_/settings/billing/subscription",
    envKeys: ["DATABASE_URL", "DIRECT_URL", "SUPABASE_PROJECT_REF"],
  },
  {
    id: "domains",
    name: "Domains / DNS (Network Solutions etc.)",
    group: "infra",
    category: "domains",
    trackMode: "manual",
    trackNote: "Domain renewals and DNS — enter invoices manually.",
    billingUrl: null,
    envKeys: [],
  },
  {
    id: "cloudflare",
    name: "Cloudflare (Workers AI / DNS)",
    group: "infra",
    category: "cloudflare",
    trackMode: "manual",
    trackNote: "Optional free-tier image AI; enter paid plan if upgraded.",
    billingUrl: "https://dash.cloudflare.com",
    envKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
  },
  {
    id: "network",
    name: "Other network / CDN",
    group: "infra",
    category: "network",
    trackMode: "manual",
    trackNote: "Catch-all for CDN, proxies, misc infra.",
    billingUrl: null,
    envKeys: [],
  },

  // ── AI ─────────────────────────────────────────────────────────────────
  {
    id: "openai",
    name: "OpenAI (product + marketing AI)",
    group: "ai",
    category: "openai",
    trackMode: "auto",
    trackNote: "Auto from AiUsageMonthly (product). Marketing images/TTS may need manual top-up.",
    billingUrl: "https://platform.openai.com/usage",
    envKeys: ["OPENAI_API_KEY"],
  },
  {
    id: "google_ai",
    name: "Google AI / Gemini",
    group: "ai",
    category: "google_ai",
    trackMode: "manual",
    trackNote: "Marketing images — enter usage invoice or free-tier $0.",
    billingUrl: "https://aistudio.google.com/",
    envKeys: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"],
  },
  {
    id: "replicate",
    name: "Replicate (video / mux)",
    group: "ai",
    category: "replicate",
    trackMode: "manual",
    trackNote: "Marketing MP4 clips — enter from Replicate billing.",
    billingUrl: "https://replicate.com/account/billing",
    envKeys: ["REPLICATE_API_TOKEN"],
  },
  {
    id: "serper",
    name: "Serper (SEO / hashtags)",
    group: "ai",
    category: "serper",
    trackMode: "manual",
    trackNote: "Search API credits — enter monthly usage.",
    billingUrl: "https://serper.dev/dashboard",
    envKeys: ["SERPER_API_KEY"],
  },
  {
    id: "xai",
    name: "xAI / Grok",
    group: "ai",
    category: "xai",
    trackMode: "manual",
    trackNote: "Optional copy model — enter if key is used.",
    billingUrl: "https://console.x.ai/",
    envKeys: ["XAI_API_KEY", "GROK_API_KEY"],
  },

  // ── Communications ─────────────────────────────────────────────────────
  {
    id: "resend",
    name: "Resend (email)",
    group: "communications",
    category: "resend",
    trackMode: "manual",
    trackNote: "Transactional email — enter Resend invoice.",
    billingUrl: "https://resend.com/settings/billing",
    envKeys: ["RESEND_API_KEY"],
  },
  {
    id: "twilio",
    name: "Twilio (SMS / voice)",
    group: "communications",
    category: "twilio",
    trackMode: "manual",
    trackNote: "Not wired in MotiveLife code yet — enter if you pay Twilio elsewhere for brand SMS/voice.",
    billingUrl: "https://console.twilio.com/us1/billing",
    envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_API_KEY"],
  },

  // ── Payments ───────────────────────────────────────────────────────────
  {
    id: "stripe_fees",
    name: "Stripe processing fees",
    group: "infra",
    category: "stripe_fees",
    trackMode: "auto",
    trackNote: "Auto from Stripe balance transaction fees.",
    billingUrl: "https://dashboard.stripe.com/balance",
    envKeys: ["STRIPE_SECRET_KEY"],
  },

  // ── Marketing / social / ads ───────────────────────────────────────────
  {
    id: "meta_boosts",
    name: "Meta ads / Instagram & Facebook boosts",
    group: "marketing",
    category: "instagram_boost",
    trackMode: "manual",
    trackNote: "Enter boost/ad invoices; tag brand (Life/FX/IQ/Pulse).",
    billingUrl: "https://business.facebook.com/billing",
    envKeys: ["MARKETING_META_ACCESS_TOKEN", "MARKETING_META_PAGE_ID"],
  },
  {
    id: "youtube_boost",
    name: "YouTube / Google promote",
    group: "marketing",
    category: "youtube_boost",
    trackMode: "manual",
    trackNote: "Promotion spend — enter manually (API uploads ≠ ads).",
    billingUrl: "https://ads.google.com",
    envKeys: ["MARKETING_YOUTUBE_REFRESH_TOKEN", "GOOGLE_CLIENT_ID"],
  },
  {
    id: "linkedin_boost",
    name: "LinkedIn boost / sponsored",
    group: "marketing",
    category: "linkedin_boost",
    trackMode: "manual",
    trackNote: "Enter Campaign Manager invoices.",
    billingUrl: "https://www.linkedin.com/campaignmanager/",
    envKeys: ["MARKETING_LINKEDIN_ACCESS_TOKEN"],
  },
  {
    id: "tiktok_boost",
    name: "TikTok ads / boosts",
    group: "marketing",
    category: "tiktok_boost",
    trackMode: "manual",
    trackNote: "Enter TikTok Ads Manager spend.",
    billingUrl: "https://ads.tiktok.com/",
    envKeys: ["MARKETING_TIKTOK_ACCESS_TOKEN"],
  },
  {
    id: "google_ads",
    name: "Google Ads / SEM",
    group: "marketing",
    category: "marketing_sco",
    trackMode: "manual",
    trackNote: "Campaign spend — enter from Google Ads (API not fully wired).",
    billingUrl: "https://ads.google.com",
    envKeys: ["MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN"],
  },
  {
    id: "buffer",
    name: "Buffer (social scheduler)",
    group: "marketing",
    category: "buffer",
    trackMode: "manual",
    trackNote: "Subscription / team plan — enter invoice.",
    billingUrl: "https://buffer.com/billing",
    envKeys: ["MARKETING_BUFFER_API_KEY"],
  },
  {
    id: "zernio",
    name: "Zernio (social scheduler)",
    group: "marketing",
    category: "zernio",
    trackMode: "manual",
    trackNote: "Enter plan cost if used instead of/in addition to Buffer.",
    billingUrl: null,
    envKeys: ["MARKETING_ZERNIO_API_KEY", "MARKETING_ZERNIO_TOKEN"],
  },
  {
    id: "scm",
    name: "SCM (social / content marketing)",
    group: "marketing",
    category: "marketing_scm",
    trackMode: "manual",
    trackNote: "Agencies, freelancers, content tools — enter manually.",
    billingUrl: null,
    envKeys: [],
  },
  {
    id: "marketing_ads",
    name: "Other paid ads",
    group: "marketing",
    category: "marketing_ads",
    trackMode: "manual",
    trackNote: "Reddit, X, display, misc paid media.",
    billingUrl: null,
    envKeys: [],
  },

  // ── Mobile / stores ────────────────────────────────────────────────────
  {
    id: "revenuecat",
    name: "RevenueCat",
    group: "mobile",
    category: "revenuecat",
    trackMode: "manual",
    trackNote: "IAP entitlement platform — enter plan if on paid tier.",
    billingUrl: "https://app.revenuecat.com",
    envKeys: [
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
      "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
      "REVENUECAT_WEBHOOK_SECRET",
    ],
  },
  {
    id: "apple_store",
    name: "Apple Developer / App Store fees",
    group: "mobile",
    category: "apple_store",
    trackMode: "manual",
    trackNote: "$99/yr + commission (track commission against income separately if needed).",
    billingUrl: "https://appstoreconnect.apple.com",
    envKeys: [],
  },
  {
    id: "google_play",
    name: "Google Play fees",
    group: "mobile",
    category: "google_play",
    trackMode: "manual",
    trackNote: "Play Console / commission — enter when Android ships paid.",
    billingUrl: "https://play.google.com/console",
    envKeys: [],
  },
  {
    id: "eas",
    name: "Expo EAS builds",
    group: "mobile",
    category: "eas",
    trackMode: "manual",
    trackNote: "Cloud build minutes — enter from Expo invoice.",
    billingUrl: "https://expo.dev/accounts/[account]/settings/billing",
    envKeys: [],
  },
];

export type OpsCostSourceStatus = OpsCostSourceDef & {
  configured: boolean;
  monthCad: number;
  dailyCad: number;
};

export function resolveOpsCostSources(
  spentByCategory: Record<string, number>,
  daysInMonth: number,
): OpsCostSourceStatus[] {
  return OPS_COST_SOURCE_DEFS.map((def) => {
    const monthCad = spentByCategory[def.category] ?? 0;
    const dailyCad =
      daysInMonth > 0 ? Math.round((monthCad / daysInMonth) * 100) / 100 : 0;
    return {
      ...def,
      // No env keys (domains, Apple, EAS…) → always available for manual entry.
      // Otherwise → configured when at least one related env is set on the server.
      configured: def.envKeys.length === 0 ? true : envSet(...def.envKeys),
      monthCad,
      dailyCad,
    };
  });
}
