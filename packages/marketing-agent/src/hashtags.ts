import { getBrandProfile } from "./brands";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export type HashtagResearchMap = Partial<Record<MarketingChannelId, string[]>>;

const CHANNEL_LIMITS: Partial<Record<MarketingChannelId, number>> = {
  instagram: 12,
  tiktok: 8,
  linkedin: 5,
  facebook: 3,
};

const BRAND_CHANNEL_QUERIES: Record<
  MarketingBrandId,
  Partial<Record<MarketingChannelId, string>>
> = {
  motivelife: {
    instagram: "instagram hashtags productivity habits goal setting AI coach app",
    facebook: "facebook hashtags productivity personal development app",
    linkedin: "linkedin hashtags productivity SaaS AI startup",
    tiktok: "tiktok hashtags productivity habits life hack AI app",
  },
  motivefx: {
    instagram: "instagram hashtags trading stocks crypto betting prediction markets fintech",
    facebook: "facebook hashtags trading investing crypto stocks market signals",
    linkedin: "linkedin hashtags fintech trading market intelligence SaaS",
    tiktok: "tiktok hashtags trading stocks crypto investing tips",
  },
  motiveiq: {
    instagram: "instagram hashtags car buying automotive fair price auto advice",
    facebook: "facebook hashtags car buying automotive consumer advice",
    linkedin: "linkedin hashtags automotive consumer fintech",
    tiktok: "tiktok hashtags car buying auto tips",
  },
};

const BRAND_CHANNEL_EXTRAS: Record<
  MarketingBrandId,
  Partial<Record<MarketingChannelId, string[]>>
> = {
  motivelife: {
    instagram: [
      "Productivity",
      "Habits",
      "GoalSetting",
      "AIcoach",
      "LifeHack",
      "Mindset",
      "SelfImprovement",
      "DailyRoutine",
    ],
    linkedin: ["Productivity", "SaaS", "AI", "Startups", "Entrepreneurship"],
    facebook: ["Productivity", "PersonalDevelopment", "AIProductivity"],
    tiktok: ["Productivity", "Habits", "LifeHack", "AIcoach", "LearnOnTikTok"],
  },
  motivefx: {
    instagram: [
      "DayTrading",
      "StockMarket",
      "CryptoTrading",
      "Bitcoin",
      "Investing",
      "FinTech",
      "PredictionMarkets",
      "SportsBetting",
    ],
    linkedin: ["FinTech", "Trading", "MarketData", "Investing", "AI"],
    facebook: ["Trading", "Investing", "Crypto", "StockMarket"],
    tiktok: ["Trading", "StockTok", "Crypto", "InvestingTips", "FinTok"],
  },
  motiveiq: {
    instagram: ["CarBuying", "AutoAdvice", "FairPrice", "CarDeals", "AutoTips"],
    linkedin: ["Automotive", "Consumer", "CarBuying"],
    facebook: ["CarBuying", "AutoAdvice"],
    tiktok: ["CarTok", "CarBuying", "AutoTips"],
  },
};

/** Meta words from SEO articles — not real campaign tags. */
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
  "tips",
  "howto",
  "examples",
  "strings",
  "array",
  "channel",
  "body",
  "ctaurl",
  "dealership",
  "automotive",
  "dealer",
  "inventory",
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
  "trade",
  "trading",
  "smarter",
  "faster",
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

function extractTagsFromBrief(brief: string, brandId: MarketingBrandId): string[] {
  const brand = getBrandProfile(brandId);
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !BRIEF_STOPWORDS.has(w));

  const tags: string[] = [];
  for (const word of words.slice(0, 6)) {
    const tag = normalizeTag(word.charAt(0).toUpperCase() + word.slice(1));
    if (tag && !isBlockedHashtag(tag)) tags.push(tag);
  }

  if (brandId === "motivelife") {
    if (brief.toLowerCase().includes("ai")) tags.push("AIcoach");
    if (brief.toLowerCase().includes("habit")) tags.push("Habits");
    if (brief.toLowerCase().includes("goal")) tags.push("GoalSetting");
    if (brief.toLowerCase().includes("productiv")) tags.push("Productivity");
    if (brief.toLowerCase().includes("voice")) tags.push("VoiceAI");
  } else if (brandId === "motivefx") {
    if (brief.toLowerCase().includes("stock")) tags.push("Stocks");
    if (brief.toLowerCase().includes("crypto")) tags.push("Crypto");
    if (brief.toLowerCase().includes("bet")) tags.push("SportsBetting");
    if (brief.toLowerCase().includes("poly") || brief.toLowerCase().includes("predict"))
      tags.push("PredictionMarkets");
    if (brief.toLowerCase().includes("signal")) tags.push("MarketIntel");
  } else if (brandId === "motiveiq") {
    if (brief.toLowerCase().includes("car") || brief.toLowerCase().includes("auto"))
      tags.push("CarBuying");
  }

  tags.push(...brand.hashtags.map(normalizeTag).filter(Boolean));
  return [...new Set(tags.filter((t) => !isBlockedHashtag(t)))];
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
    body: JSON.stringify({ q: query, num: 8 }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    organic?: Array<{ title?: string; snippet?: string }>;
    answerBox?: { snippet?: string };
  };
  return extractFromSerperResults(data);
}

function fallbackHashtags(brandId: MarketingBrandId, channel: MarketingChannelId): string[] {
  const brand = getBrandProfile(brandId);
  const base = brand.hashtags.map(normalizeTag).filter((t) => t && !isBlockedHashtag(t));
  const extras = BRAND_CHANNEL_EXTRAS[brandId][channel] ?? [];

  const merged = [...new Set([...base, ...extras])].filter((t) => !isBlockedHashtag(t));
  const limit = CHANNEL_LIMITS[channel] ?? 5;
  return merged.slice(0, limit);
}

function curateHashtagList(
  channel: MarketingChannelId,
  candidates: string[],
  brandId: MarketingBrandId,
  brief: string
): string[] {
  const limit = CHANNEL_LIMITS[channel] ?? 5;
  const briefTags = extractTagsFromBrief(brief, brandId);
  const fallback = fallbackHashtags(brandId, channel);

  const merged = [
    ...new Set([
      ...fallback,
      ...briefTags,
      ...candidates.map(normalizeTag).filter((t) => t && !isBlockedHashtag(t)),
    ]),
  ];

  return merged.slice(0, limit);
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
    .slice(0, 4)
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

      result[channel] = curateHashtagList(channel, researched, brandId, brief);
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

  const candidates = [...researched, ...validAi];
  if (brandId && brief) {
    return curateHashtagList(channel, candidates, brandId, brief);
  }

  const limit = CHANNEL_LIMITS[channel] ?? 5;
  return [...new Set(candidates)].slice(0, limit);
}

export function formatHashtagsForPrompt(research: HashtagResearchMap): string {
  return Object.entries(research)
    .map(([ch, tags]) => `${ch}: ${tags.map((t) => `#${t}`).join(" ")}`)
    .join("\n");
}
