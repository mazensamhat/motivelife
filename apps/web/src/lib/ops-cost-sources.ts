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
  /** Baseline mode; may upgrade to auto when required env for sync is present */
  trackMode: CostTrackMode;
  trackNote: string;
  billingUrl: string | null;
  /** Env keys that indicate this vendor is wired in production */
  envKeys: string[];
  /** Extra keys required to turn on auto sync (beyond detection) */
  autoEnvKeys?: string[];
  /** How to wire when not detected */
  wireHint: string;
};

function envSet(...keys: string[]): boolean {
  return keys.some((k) => Boolean(process.env[k]?.trim()));
}

function envAll(...keys: string[]): boolean {
  return keys.length > 0 && keys.every((k) => Boolean(process.env[k]?.trim()));
}

export const OPS_COST_SOURCE_DEFS: OpsCostSourceDef[] = [
  {
    id: "vercel",
    name: "Vercel (hosting / cron)",
    group: "infra",
    category: "vercel",
    trackMode: "manual",
    trackNote: "No public billing $ API — enter invoice (VERCEL_TOKEN only powers deploy status).",
    billingUrl: "https://vercel.com/account/billing",
    envKeys: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
    wireHint: "Vercel → Settings → Tokens → set VERCEL_TOKEN + VERCEL_PROJECT_ID on Vercel env.",
  },
  {
    id: "vercel_blob",
    name: "Vercel Blob",
    group: "infra",
    category: "vercel_blob",
    trackMode: "manual",
    trackNote: "Storage line on Vercel invoice — enter manually.",
    billingUrl: "https://vercel.com/account/billing",
    envKeys: ["BLOB_READ_WRITE_TOKEN"],
    wireHint: "Vercel → Storage → Blob → create store → BLOB_READ_WRITE_TOKEN.",
  },
  {
    id: "supabase",
    name: "Supabase (Postgres)",
    group: "infra",
    category: "supabase",
    trackMode: "manual",
    trackNote: "Plan/overage — enter from Supabase billing (no $ sync API in this app).",
    billingUrl: "https://supabase.com/dashboard/project/_/settings/billing/subscription",
    envKeys: ["DATABASE_URL", "DIRECT_URL", "SUPABASE_PROJECT_REF"],
    wireHint: "Already required for the app. Set SUPABASE_PROJECT_REF for clearer Ops links.",
  },
  {
    id: "domains",
    name: "Domains / DNS (Network Solutions etc.)",
    group: "infra",
    category: "domains",
    trackMode: "manual",
    trackNote: "Renewals — always manual invoices.",
    billingUrl: null,
    envKeys: [],
    wireHint: "Enter yearly/monthly domain invoices under Domains preset.",
  },
  {
    id: "cloudflare",
    name: "Cloudflare (Workers AI / DNS)",
    group: "infra",
    category: "cloudflare",
    trackMode: "manual",
    trackNote: "Optional; enter paid plan if upgraded.",
    billingUrl: "https://dash.cloudflare.com",
    envKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
    wireHint: "Cloudflare → My Profile → API Tokens → CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.",
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
    wireHint: "Use Other / Network category for misc invoices.",
  },
  {
    id: "openai",
    name: "OpenAI (product + marketing AI)",
    group: "ai",
    category: "openai",
    trackMode: "auto",
    trackNote:
      "Auto: OPENAI_ADMIN_KEY → org Costs API (best). Else AiUsageMonthly estimate (product only).",
    billingUrl: "https://platform.openai.com/usage",
    envKeys: ["OPENAI_API_KEY", "OPENAI_ADMIN_KEY"],
    autoEnvKeys: ["OPENAI_API_KEY", "OPENAI_ADMIN_KEY"],
    wireHint:
      "Set OPENAI_API_KEY (app). For full $ sync: platform.openai.com → Organization → Admin keys → OPENAI_ADMIN_KEY.",
  },
  {
    id: "google_ai",
    name: "Google AI / Gemini",
    group: "ai",
    category: "google_ai",
    trackMode: "manual",
    trackNote: "No reliable $ API from AI Studio key — enter invoice or $0 on free tier.",
    billingUrl: "https://aistudio.google.com/",
    envKeys: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"],
    wireHint: "Google AI Studio → Get API key → GOOGLE_AI_API_KEY (or GEMINI_API_KEY).",
  },
  {
    id: "replicate",
    name: "Replicate (video / mux)",
    group: "ai",
    category: "replicate",
    trackMode: "manual",
    trackNote: "No billing API — enter from replicate.com/account/billing.",
    billingUrl: "https://replicate.com/account/billing",
    envKeys: ["REPLICATE_API_TOKEN"],
    wireHint: "replicate.com → Account → API tokens → REPLICATE_API_TOKEN.",
  },
  {
    id: "serper",
    name: "Serper (SEO / hashtags)",
    group: "ai",
    category: "serper",
    trackMode: "manual",
    trackNote: "Credits — enter monthly usage from dashboard.",
    billingUrl: "https://serper.dev/dashboard",
    envKeys: ["SERPER_API_KEY"],
    wireHint: "serper.dev → API key → SERPER_API_KEY.",
  },
  {
    id: "xai",
    name: "xAI / Grok",
    group: "ai",
    category: "xai",
    trackMode: "manual",
    trackNote: "Optional — enter if used.",
    billingUrl: "https://console.x.ai/",
    envKeys: ["XAI_API_KEY", "GROK_API_KEY"],
    wireHint: "console.x.ai → API key → XAI_API_KEY.",
  },
  {
    id: "resend",
    name: "Resend (email)",
    group: "communications",
    category: "resend",
    trackMode: "auto",
    trackNote:
      "Auto estimates from sent-email count + RESEND_MONTHLY_PLAN_USD / overage envs.",
    billingUrl: "https://resend.com/settings/billing",
    envKeys: ["RESEND_API_KEY"],
    autoEnvKeys: ["RESEND_API_KEY"],
    wireHint:
      "resend.com → API Keys → RESEND_API_KEY. Set RESEND_MONTHLY_PLAN_USD to your plan $ for accurate sync.",
  },
  {
    id: "twilio",
    name: "Twilio (SMS / voice)",
    group: "communications",
    category: "twilio",
    trackMode: "auto",
    trackNote: "Auto from Twilio Usage Records when SID + Auth Token set (not used by app mail).",
    billingUrl: "https://console.twilio.com/us1/billing",
    envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    autoEnvKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    wireHint:
      "console.twilio.com → Account → API keys & tokens → TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN on Vercel.",
  },
  {
    id: "stripe_fees",
    name: "Stripe processing fees",
    group: "infra",
    category: "stripe_fees",
    trackMode: "auto",
    trackNote: "Auto from Stripe balance transaction fees.",
    billingUrl: "https://dashboard.stripe.com/balance",
    envKeys: ["STRIPE_SECRET_KEY"],
    autoEnvKeys: ["STRIPE_SECRET_KEY"],
    wireHint: "Stripe Dashboard → Developers → API keys → STRIPE_SECRET_KEY.",
  },
  {
    id: "meta_boosts",
    name: "Meta ads / Instagram & Facebook boosts",
    group: "marketing",
    category: "marketing_ads",
    trackMode: "auto",
    trackNote:
      "Auto Insights spend when MARKETING_META_AD_ACCOUNT_ID + token (ads_read). Else manual.",
    billingUrl: "https://business.facebook.com/billing",
    envKeys: ["MARKETING_META_ACCESS_TOKEN", "MARKETING_META_AD_ACCOUNT_ID"],
    autoEnvKeys: ["MARKETING_META_ACCESS_TOKEN", "MARKETING_META_AD_ACCOUNT_ID"],
    wireHint:
      "Business Manager → Ad account ID → MARKETING_META_AD_ACCOUNT_ID. Token needs ads_read / read_insights (system user recommended).",
  },
  {
    id: "youtube_boost",
    name: "YouTube / Google promote",
    group: "marketing",
    category: "youtube_boost",
    trackMode: "manual",
    trackNote: "Upload API ≠ ads — promote spend stays manual / Google Ads API later.",
    billingUrl: "https://ads.google.com",
    envKeys: ["MARKETING_YOUTUBE_REFRESH_TOKEN", "GOOGLE_CLIENT_ID"],
    wireHint: "YouTube OAuth refresh token for uploads; boost $ via Google Ads or manual preset.",
  },
  {
    id: "linkedin_boost",
    name: "LinkedIn boost / sponsored",
    group: "marketing",
    category: "linkedin_boost",
    trackMode: "manual",
    trackNote: "Campaign Manager spend API not wired — enter invoices.",
    billingUrl: "https://www.linkedin.com/campaignmanager/",
    envKeys: ["MARKETING_LINKEDIN_ACCESS_TOKEN"],
    wireHint: "LinkedIn Developer app → Marketing Developer Platform + ads reporting (future).",
  },
  {
    id: "tiktok_boost",
    name: "TikTok ads / boosts",
    group: "marketing",
    category: "tiktok_boost",
    trackMode: "manual",
    trackNote: "Ads Manager spend — manual until Marketing API wired.",
    billingUrl: "https://ads.tiktok.com/",
    envKeys: ["MARKETING_TIKTOK_ACCESS_TOKEN"],
    wireHint: "TikTok Ads → API access → MARKETING_TIKTOK_ACCESS_TOKEN (posting) + ads spend manual.",
  },
  {
    id: "google_ads",
    name: "Google Ads / SEM",
    group: "marketing",
    category: "marketing_sco",
    trackMode: "manual",
    trackNote: "Needs developer token + OAuth customer — not fully wired; enter spend.",
    billingUrl: "https://ads.google.com",
    envKeys: ["MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN"],
    wireHint:
      "Google Ads → API Center developer token + OAuth. Until wired, use Google Ads / SCO preset.",
  },
  {
    id: "buffer",
    name: "Buffer (social scheduler)",
    group: "marketing",
    category: "buffer",
    trackMode: "manual",
    trackNote: "Fixed subscription — enter invoice.",
    billingUrl: "https://buffer.com/billing",
    envKeys: ["MARKETING_BUFFER_API_KEY"],
    wireHint: "Buffer → Account → API → MARKETING_BUFFER_API_KEY (+ channel IDs).",
  },
  {
    id: "zernio",
    name: "Zernio (social scheduler)",
    group: "marketing",
    category: "zernio",
    trackMode: "manual",
    trackNote: "Enter plan cost if used.",
    billingUrl: null,
    envKeys: ["MARKETING_ZERNIO_API_KEY", "MARKETING_ZERNIO_TOKEN"],
    wireHint: "Set MARKETING_ZERNIO_API_KEY or MARKETING_ZERNIO_TOKEN if using Zernio.",
  },
  {
    id: "scm",
    name: "SCM (social / content marketing)",
    group: "marketing",
    category: "marketing_scm",
    trackMode: "manual",
    trackNote: "Agencies / freelancers — always manual.",
    billingUrl: null,
    envKeys: [],
    wireHint: "Use SCM preset for agency/content invoices.",
  },
  {
    id: "marketing_ads",
    name: "Other paid ads",
    group: "marketing",
    category: "marketing_ads",
    trackMode: "manual",
    trackNote: "Reddit, X, display, misc — manual (Meta total also lands here when auto).",
    billingUrl: null,
    envKeys: [],
    wireHint: "Use Other ads preset for non-Meta paid media.",
  },
  {
    id: "revenuecat",
    name: "RevenueCat",
    group: "mobile",
    category: "revenuecat",
    trackMode: "manual",
    trackNote: "Plan fee — enter if on paid RC tier (IAP commission is Apple/Google).",
    billingUrl: "https://app.revenuecat.com",
    envKeys: [
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
      "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
      "REVENUECAT_WEBHOOK_SECRET",
    ],
    wireHint: "RevenueCat → Project → API keys + webhook → EAS + Vercel secrets.",
  },
  {
    id: "apple_store",
    name: "Apple Developer / App Store fees",
    group: "mobile",
    category: "apple_store",
    trackMode: "manual",
    trackNote: "$99/yr + commission — manual / ASC reports.",
    billingUrl: "https://appstoreconnect.apple.com",
    envKeys: [],
    wireHint: "Enter Apple Developer renewal; commission is income offset not Ops auto yet.",
  },
  {
    id: "google_play",
    name: "Google Play fees",
    group: "mobile",
    category: "google_play",
    trackMode: "manual",
    trackNote: "Play fees — manual.",
    billingUrl: "https://play.google.com/console",
    envKeys: [],
    wireHint: "Enter Play Console fees when Android paid ships.",
  },
  {
    id: "eas",
    name: "Expo EAS builds",
    group: "mobile",
    category: "eas",
    trackMode: "manual",
    trackNote: "Build minutes — enter Expo invoice.",
    billingUrl: "https://expo.dev/accounts/[account]/settings/billing",
    envKeys: [],
    wireHint: "expo.dev → Billing → enter monthly EAS usage.",
  },
];

export type OpsCostSourceStatus = OpsCostSourceDef & {
  configured: boolean;
  autoReady: boolean;
  effectiveTrackMode: CostTrackMode;
  monthCad: number;
  dailyCad: number;
};

export function resolveOpsCostSources(
  spentByCategory: Record<string, number>,
  daysInMonth: number,
): OpsCostSourceStatus[] {
  return OPS_COST_SOURCE_DEFS.map((def) => {
    const configured = def.envKeys.length === 0 ? true : envSet(...def.envKeys);
    const autoKeys = def.autoEnvKeys ?? [];
    // Meta/Twilio need ALL keys; OpenAI/Resend/Stripe need any of the auto keys.
    const strictAuto =
      def.id === "meta_boosts" || def.id === "twilio"
        ? envAll(...autoKeys)
        : autoKeys.length === 0
          ? configured
          : envSet(...autoKeys);
    const effectiveTrackMode: CostTrackMode =
      def.trackMode === "auto" && strictAuto
        ? "auto"
        : def.trackMode === "auto"
          ? "manual"
          : def.trackMode;

    const monthCad = spentByCategory[def.category] ?? 0;
    const dailyCad =
      daysInMonth > 0 ? Math.round((monthCad / daysInMonth) * 100) / 100 : 0;
    return {
      ...def,
      configured,
      autoReady: strictAuto && def.trackMode === "auto",
      effectiveTrackMode,
      monthCad,
      dailyCad,
    };
  });
}
