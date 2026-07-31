import { getBrandProfile } from "./brands";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export type HashtagResearchMap = Partial<Record<MarketingChannelId, string[]>>;

const CHANNEL_LIMITS: Partial<Record<MarketingChannelId, number>> = {
  instagram: 12,
  tiktok: 8,
  linkedin: 5,
  facebook: 3,
  reddit: 0,
  x: 3,
  threads: 5,
  youtube: 5,
};

const BRAND_CHANNEL_QUERIES: Record<
  MarketingBrandId,
  Partial<Record<MarketingChannelId, string>>
> = {
  motivelife: {
    instagram: "best instagram hashtags productivity habits AI life coach app 2025",
    facebook: "facebook hashtags personal development productivity app",
    linkedin: "linkedin hashtags productivity SaaS AI startup founders",
    tiktok: "tiktok hashtags productivity habits AI app lifeOS",
    x: "twitter hashtags productivity AI tools habits",
    threads: "threads hashtags productivity self improvement AI",
    youtube: "youtube shorts hashtags productivity AI coach",
  },
  motivefx: {
    instagram: "instagram hashtags day trading stocks crypto prediction markets",
    facebook: "facebook hashtags trading investing crypto stocks",
    linkedin: "linkedin hashtags fintech trading market intelligence",
    tiktok: "tiktok hashtags trading StockTok crypto FinTok",
    x: "twitter hashtags trading crypto stocks fintech",
    threads: "threads hashtags trading investing markets",
    youtube: "youtube shorts hashtags trading crypto investing",
  },
  motiveiq: {
    instagram: "instagram hashtags coming soon secret project startup",
    facebook: "facebook hashtags coming soon secret project",
    linkedin: "linkedin hashtags coming soon startup NDA",
    tiktok: "tiktok hashtags coming soon secret project",
    x: "twitter hashtags coming soon secret project",
    threads: "threads hashtags coming soon secret project",
    youtube: "youtube shorts hashtags coming soon secret project",
  },
  motivepulse: {
    instagram: "instagram hashtags google reviews reputation local business growth",
    facebook: "facebook hashtags google reviews local business reputation",
    linkedin: "linkedin hashtags reputation management local SEO SMB SaaS",
    tiktok: "tiktok hashtags google reviews small business tips",
    x: "twitter hashtags google reviews local SEO SMB",
    threads: "threads hashtags local business reputation reviews",
    youtube: "youtube shorts hashtags google reviews local business",
  },
};

/** Evergreen channel extras — used last, only to fill remaining slots. */
const BRAND_CHANNEL_EXTRAS: Record<
  MarketingBrandId,
  Partial<Record<MarketingChannelId, string[]>>
> = {
  motivelife: {
    instagram: ["Productivity", "Habits", "GoalSetting", "AIcoach", "Mindset", "SelfImprovement"],
    linkedin: ["Productivity", "SaaS", "AI", "Startups"],
    facebook: ["Productivity", "PersonalDevelopment"],
    tiktok: ["Productivity", "Habits", "AIcoach", "LearnOnTikTok"],
    x: ["Productivity", "AI", "LifeOS"],
    threads: ["Productivity", "Habits", "AIcoach"],
    youtube: ["Productivity", "AIcoach", "LifeOS"],
  },
  motivefx: {
    instagram: ["DayTrading", "StockMarket", "CryptoTrading", "Investing", "FinTech"],
    linkedin: ["FinTech", "Trading", "MarketData", "Investing"],
    facebook: ["Trading", "Investing", "Crypto"],
    tiktok: ["Trading", "StockTok", "Crypto", "FinTok"],
    x: ["Trading", "Crypto", "FinTech"],
    threads: ["Trading", "Investing", "Crypto"],
    youtube: ["Trading", "Crypto", "Investing"],
  },
  motiveiq: {
    instagram: ["DealerGrowth", "AutomotiveDealers", "DealershipOps", "AutoRetail"],
    linkedin: ["AutomotiveRetail", "DealershipOps", "DealerGrowth"],
    facebook: ["CarDealership", "AutomotiveRetail"],
    tiktok: ["DealershipTips", "AutoRetail", "DealerGrowth"],
    x: ["AutoRetail", "DealershipOps"],
    threads: ["DealerGrowth", "AutoRetail"],
    youtube: ["DealerGrowth", "AutomotiveRetail"],
  },
  motivepulse: {
    instagram: [
      "GoogleReviews",
      "ReputationManagement",
      "LocalBusiness",
      "SmallBusiness",
      "LocalSEO",
      "BusinessGrowth",
    ],
    linkedin: ["ReputationManagement", "LocalSEO", "SaaS", "SMB"],
    facebook: ["GoogleReviews", "LocalBusiness", "SmallBusiness"],
    tiktok: ["GoogleReviews", "SmallBusinessTips", "LocalBusiness"],
    x: ["GoogleReviews", "LocalSEO", "SMB"],
    threads: ["GoogleReviews", "LocalBusiness"],
    youtube: ["GoogleReviews", "LocalBusiness", "ReputationManagement"],
  },
};

/** Meta / spam words from SEO listicles — not real campaign tags. */
const BLOCKED_TAGS = new Set([
  "hashtags",
  "hashtag",
  "keywords",
  "keyword",
  "tags",
  "tag",
  "trending",
  "viral",
  "follow",
  "like",
  "share",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "reddit",
  "youtube",
  "twitter",
  "threads",
  "socialmedia",
  "social",
  "marketing",
  "content",
  "post",
  "posts",
  "reels",
  "story",
  "stories",
  "best",
  "top",
  "list",
  "guide",
  "examples",
  "strings",
  "array",
  "channel",
  "body",
  "ctaurl",
  "2024",
  "2025",
  "2026",
]);

const BRIEF_STOPWORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "your",
  "have",
  "will",
  "into",
  "when",
  "what",
  "them",
  "they",
  "about",
  "help",
  "helps",
  "just",
  "more",
  "than",
  "many",
  "over",
  "apps",
  "app",
  "life",
  "talk",
  "free",
  "trial",
  "days",
  "day",
  "motive",
  "motivelife",
  "motivefx",
  "motivepulse",
  "motiveiq",
  "make",
  "using",
  "using",
  "launch",
  "post",
  "week",
]);

function normalizeTag(tag: string): string {
  const t = tag.trim().replace(/^#+/, "");
  if (!t || t.length > 40 || !/^[a-zA-Z0-9_]+$/.test(t)) return "";
  return t;
}

export function isBlockedHashtag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  if (BLOCKED_TAGS.has(lower)) return true;
  if (lower.length < 3) return true;
  return false;
}

function extractHashtagsFromText(text: string): string[] {
  const found = text.match(/#[a-zA-Z0-9_]+/g) ?? [];
  return [...new Set(found.map((h) => normalizeTag(h)).filter((t) => t && !isBlockedHashtag(t)))];
}

/** Topic tags from brief: prefer multi-word CamelCase phrases, then intent keywords. */
function extractTopicTags(brief: string, brandId: MarketingBrandId): string[] {
  const lower = brief.toLowerCase();
  const tags: string[] = [];

  if (brandId === "motivelife") {
    if (/\bvoice\b/.test(lower)) tags.push("VoiceAI");
    if (/\bhabit/.test(lower)) tags.push("Habits");
    if (/\bgoal/.test(lower)) tags.push("GoalSetting");
    if (/productiv/.test(lower)) tags.push("Productivity");
    if (/\bai\b|coach/.test(lower)) tags.push("AIcoach");
    if (/life.?score|morning|briefing/.test(lower)) tags.push("LifeOS");
    if (/money|budget|financ/.test(lower)) tags.push("MoneyMindset");
    if (/health|fitness|sleep/.test(lower)) tags.push("HealthyHabits");
  } else if (brandId === "motivefx") {
    if (/stock/.test(lower)) tags.push("Stocks");
    if (/crypto|bitcoin|eth/.test(lower)) tags.push("Crypto");
    if (/bet|sportsbook/.test(lower)) tags.push("SportsBetting");
    if (/poly|predict/.test(lower)) tags.push("PredictionMarkets");
    if (/signal/.test(lower)) tags.push("MarketIntel");
    if (/portfolio/.test(lower)) tags.push("Portfolio");
  } else if (brandId === "motiveiq") {
    if (/dealer|dealership|f&i|inventory|service bay/.test(lower)) tags.push("DealershipOps");
    if (/lead|pipeline|sales/.test(lower)) tags.push("DealerGrowth");
    if (/auto|vehicle|car\b/.test(lower)) tags.push("AutoRetail");
  } else if (brandId === "motivepulse") {
    if (/review/.test(lower)) tags.push("GoogleReviews");
    if (/reputat/.test(lower)) tags.push("ReputationManagement");
    if (/score/.test(lower)) tags.push("MotiveScore");
    if (/local|business|smb|owner/.test(lower)) tags.push("LocalBusiness");
    if (/competitor|seo/.test(lower)) tags.push("LocalSEO");
    if (/reply|response/.test(lower)) tags.push("CustomerExperience");
  }

  return [...new Set(tags.filter((t) => !isBlockedHashtag(t)))];
}

function brandCoreTags(brandId: MarketingBrandId): string[] {
  return getBrandProfile(brandId)
    .hashtags.map(normalizeTag)
    .filter((t) => t && !isBlockedHashtag(t))
    .slice(0, 2);
}

function extractFromSerperResults(data: {
  organic?: Array<{ title?: string; snippet?: string }>;
  answerBox?: { snippet?: string };
}): string[] {
  const chunks: string[] = [];
  if (data.answerBox?.snippet) chunks.push(data.answerBox.snippet);
  for (const row of data.organic ?? []) {
    if (row.title) chunks.push(row.title);
    if (row.snippet) chunks.push(row.snippet);
  }
  return [...new Set(chunks.flatMap(extractHashtagsFromText))];
}

async function serperSearch(query: string, apiKey: string): Promise<string[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    organic?: Array<{ title?: string; snippet?: string }>;
    answerBox?: { snippet?: string };
  };
  return extractFromSerperResults(data);
}

/**
 * Rank: brand core → brief topic → researched → AI candidates → evergreen filler.
 * Research and topic beat static filler so posts feel campaign-specific.
 */
function curateHashtagList(
  channel: MarketingChannelId,
  researched: string[],
  aiTags: string[],
  brandId: MarketingBrandId,
  brief: string
): string[] {
  const limit = CHANNEL_LIMITS[channel] ?? 5;
  if (limit === 0) return [];

  const core = brandCoreTags(brandId);
  const topic = extractTopicTags(brief, brandId);
  const researchClean = researched
    .map(normalizeTag)
    .filter((t) => t && !isBlockedHashtag(t));
  const aiClean = aiTags.map(normalizeTag).filter((t) => t && !isBlockedHashtag(t));
  const filler = (BRAND_CHANNEL_EXTRAS[brandId][channel] ?? []).filter(
    (t) => !isBlockedHashtag(t)
  );

  const ranked = [...core, ...topic, ...researchClean, ...aiClean, ...filler];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of ranked) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

/** Web research + brand defaults → platform-specific hashtag sets. */
export async function researchHashtags(
  brandId: MarketingBrandId,
  brief: string,
  channels: MarketingChannelId[]
): Promise<HashtagResearchMap> {
  const serperKey = process.env.SERPER_API_KEY?.trim();
  const briefWords = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !BRIEF_STOPWORDS.has(w))
    .slice(0, 5)
    .join(" ");

  const result: HashtagResearchMap = {};

  await Promise.all(
    channels.map(async (channel) => {
      let researched: string[] = [];
      const baseQuery = BRAND_CHANNEL_QUERIES[brandId][channel];

      if (serperKey && baseQuery) {
        const query = `${baseQuery} ${briefWords}`.trim();
        researched = await serperSearch(query, serperKey);
      }

      result[channel] = curateHashtagList(channel, researched, [], brandId, brief);
    })
  );

  return result;
}

export function mergePostHashtags(
  channel: MarketingChannelId,
  aiTags: string[] | undefined,
  research: HashtagResearchMap,
  brandId?: MarketingBrandId,
  brief?: string
): string[] {
  const researched = research[channel] ?? [];
  const validAi = (aiTags ?? [])
    .map(normalizeTag)
    .filter((t) => t && !isBlockedHashtag(t));

  if (brandId && brief) {
    return curateHashtagList(channel, researched, validAi, brandId, brief);
  }

  const limit = CHANNEL_LIMITS[channel] ?? 5;
  return [...new Set([...researched, ...validAi])].slice(0, limit);
}

export function formatHashtagsForPrompt(research: HashtagResearchMap): string {
  return Object.entries(research)
    .map(([ch, tags]) => `${ch}: ${tags.map((t) => `#${t}`).join(" ")}`)
    .join("\n");
}
