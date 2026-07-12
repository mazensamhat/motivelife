export type PlatformId = "motivelife" | "motiveiq" | "motivefx" | "motivepulse";

export type Platform = {
  id: PlatformId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  audience: string;
  /** Who this is for — bridge / comparison copy */
  forWhom: string;
  /** Core problem the product solves */
  problem: string;
  /** Outcome users get */
  outcome: string;
  /** Short lane label for hero chips */
  lane: string;
  cta: string;
  siteUrl: string;
  accent: string;
  accentSoft: string;
  /** Official store logo artwork — use as-is, do not recreate. */
  logo: string;
  slug: string;
};

export const CORP_LOGO = "/brand/motive-corp-logo.png";
export const CORP_FAMILY_LOGO = "/brand/motive-corp-family.png";
export const CORP_SITE = "https://www.motive-corp.com";

export const PLATFORMS: Platform[] = [
  {
    id: "motivelife",
    name: "MotiveLife.ai",
    shortName: "MotiveLife",
    tagline: "Live better. Grow every day.",
    description:
      "Your AI life operating system — career, money, health, and habits in one place. Just talk.",
    audience: "Personal growth & daily momentum",
    forWhom: "Individuals who want one place to run career, money, health, and habits",
    problem: "Life goals scatter across apps, notes, and good intentions that fade.",
    outcome: "Talk your way through priorities and leave with clearer next moves every day.",
    lane: "life",
    cta: "Start 14-day free trial",
    siteUrl: "https://www.mymotivelife.com",
    accent: "#2EE6A8",
    accentSoft: "rgba(46, 230, 168, 0.14)",
    logo: "/brand/motivelife.png",
    slug: "motivelife",
  },
  {
    id: "motiveiq",
    name: "MotiveIQ",
    shortName: "MotiveIQ",
    tagline: "Automotive Intelligence",
    description: "Automotive Intelligence",
    audience: "",
    forWhom: "",
    problem: "",
    outcome: "",
    lane: "Automotive Intelligence",
    cta: "Coming soon",
    siteUrl: "https://www.motiveiqs.com/gate",
    accent: "#3B9EFF",
    accentSoft: "rgba(59, 158, 255, 0.14)",
    logo: "/brand/motiveiq.png",
    slug: "motiveiq",
  },
  {
    id: "motivefx",
    name: "MotiveFX.AI",
    shortName: "MotiveFX",
    tagline: "Trade smarter. Move faster.",
    description:
      "AI market command center — ranked signals and portfolio context across stocks, crypto, and prediction markets.",
    audience: "Traders & investors",
    forWhom: "Active traders and investors across stocks, crypto, and prediction markets",
    problem: "Market noise outpaces attention — signals get buried in feeds and tabs.",
    outcome: "Ranked signals and portfolio context so you move with clearer conviction.",
    lane: "trades",
    cta: "Start free trial",
    siteUrl: "https://www.motivefxai.com",
    accent: "#C84DFF",
    accentSoft: "rgba(200, 77, 255, 0.14)",
    logo: "/brand/motivefx.png",
    slug: "motivefx",
  },
  {
    id: "motivepulse",
    name: "MotivePulse IQ",
    shortName: "MotivePulse",
    tagline: "Insights. Automation. Growth.",
    description:
      "Reputation and Google review automation for local businesses — growth without hiring a marketing team.",
    audience: "Local & multi-location businesses",
    forWhom: "Local and multi-location businesses that live on Google reviews",
    problem: "Reputation growth stalls without a marketing team or consistent review ops.",
    outcome: "Automated review and reputation workflows that grow local demand.",
    lane: "local business growth",
    cta: "Get your free Motive Score",
    siteUrl: "https://www.mymotivepulse.com",
    accent: "#E8C547",
    accentSoft: "rgba(232, 197, 71, 0.14)",
    logo: "/brand/motivepulse.png",
    slug: "motivepulse",
  },
];

export function getPlatform(slug: string): Platform | undefined {
  return PLATFORMS.find((p) => p.slug === slug);
}

export function isMotiveIq(platform: Platform | PlatformId) {
  return typeof platform === "string"
    ? platform === "motiveiq"
    : platform.id === "motiveiq";
}

export function buildPlatformUrl(
  platform: Platform,
  opts?: { content?: string; campaign?: string },
) {
  const url = new URL(platform.siteUrl);
  url.searchParams.set("utm_source", "motive-corp");
  url.searchParams.set("utm_medium", "portfolio");
  url.searchParams.set("utm_campaign", opts?.campaign ?? platform.id);
  if (opts?.content) url.searchParams.set("utm_content", opts.content);
  return url.toString();
}

export function logoAlt(platform: Platform) {
  return `${platform.name} — ${platform.tagline}`;
}
