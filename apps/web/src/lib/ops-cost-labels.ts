/** Human labels + marketing presets for Ops cost ledger. */

export const OPS_COST_CATEGORY_LABELS: Record<string, string> = {
  openai: "OpenAI",
  vercel: "Vercel",
  supabase: "Supabase",
  stripe_fees: "Stripe fees",
  resend: "Resend",
  marketing_ads: "Marketing ads",
  marketing_boosts: "Marketing boosts (general)",
  youtube_boost: "YouTube boosting",
  instagram_boost: "Instagram boosting",
  facebook_boost: "Facebook boosting",
  linkedin_boost: "LinkedIn boosting",
  marketing_scm: "SCM (social / content marketing)",
  marketing_sco: "SCO (search / campaign ops)",
  network: "Network / infra",
  other: "Other",
};

export type MarketingCostPreset = {
  id: string;
  label: string;
  category: string;
  vendor: string;
  description: string;
};

/** One-click manual entry starters for common marketing spend. */
export const MARKETING_COST_PRESETS: MarketingCostPreset[] = [
  {
    id: "yt",
    label: "YouTube boost",
    category: "youtube_boost",
    vendor: "YouTube",
    description: "YouTube promotion / boost",
  },
  {
    id: "ig",
    label: "Instagram boost",
    category: "instagram_boost",
    vendor: "Meta / Instagram",
    description: "Instagram boost",
  },
  {
    id: "fb",
    label: "Facebook boost",
    category: "facebook_boost",
    vendor: "Meta / Facebook",
    description: "Facebook boost",
  },
  {
    id: "li",
    label: "LinkedIn boost",
    category: "linkedin_boost",
    vendor: "LinkedIn",
    description: "LinkedIn boost / sponsored",
  },
  {
    id: "scm",
    label: "SCM",
    category: "marketing_scm",
    vendor: "",
    description: "Social / content marketing",
  },
  {
    id: "sco",
    label: "SCO",
    category: "marketing_sco",
    vendor: "",
    description: "Search / campaign ops",
  },
  {
    id: "ads",
    label: "Other ads",
    category: "marketing_ads",
    vendor: "",
    description: "Paid ads",
  },
  {
    id: "boost",
    label: "Other boost",
    category: "marketing_boosts",
    vendor: "",
    description: "Content boost",
  },
];

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
