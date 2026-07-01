import { getBrandProfile } from "./brands";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export type HashtagResearchMap = Partial<Record<MarketingChannelId, string[]>>;

const CHANNEL_LIMITS: Partial<Record<MarketingChannelId, number>> = {
  instagram: 15,
  tiktok: 8,
  linkedin: 5,
  facebook: 3,
};

const CHANNEL_QUERIES: Partial<Record<MarketingChannelId, string>> = {
  instagram: "best instagram hashtags productivity AI life coach app 2025",
  facebook: "facebook page hashtags productivity app marketing",
  linkedin: "best linkedin hashtags productivity SaaS startup 2025",
  tiktok: "tiktok hashtags productivity habits AI app trending",
};

function normalizeTag(tag: string): string {
  const t = tag.trim().replace(/^#+/, "");
  if (!t || t.length > 40 || !/^[a-zA-Z0-9_]+$/.test(t)) return "";
  return t;
}

function extractHashtagsFromText(text: string): string[] {
  const found = text.match(/#[a-zA-Z0-9_]+/g) ?? [];
  return [...new Set(found.map((h) => normalizeTag(h)).filter(Boolean))];
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
  const base = brand.hashtags.map(normalizeTag).filter(Boolean);

  const extras: Partial<Record<MarketingChannelId, string[]>> = {
    instagram: [
      "productivity",
      "habits",
      "goalsetting",
      "aicoach",
      "lifehack",
      "mindset",
      "selfimprovement",
      "dailyroutine",
      "motivation",
      "startup",
    ],
    linkedin: ["productivity", "SaaS", "AI", "startups", "entrepreneurship", "careerdevelopment"],
    facebook: ["MotiveLife", "productivity", "AI"],
    tiktok: ["productivity", "habits", "lifehack", "aicoach", "fyp", "learnontiktok"],
  };

  const merged = [...new Set([...base, ...(extras[channel] ?? [])])];
  const limit = CHANNEL_LIMITS[channel] ?? 5;
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
    .filter((w) => w.length > 3)
    .slice(0, 4)
    .join(" ");

  const result: HashtagResearchMap = {};

  for (const channel of channels) {
    const limit = CHANNEL_LIMITS[channel] ?? 5;
    let researched: string[] = [];

    if (serperKey && CHANNEL_QUERIES[channel]) {
      const query = `${CHANNEL_QUERIES[channel]} ${briefWords}`.trim();
      researched = await serperSearch(query, serperKey);
    }

    const merged = [
      ...new Set([
        ...researched,
        ...fallbackHashtags(brandId, channel),
        ...extractHashtagsFromText(brief),
      ]),
    ]
      .map(normalizeTag)
      .filter(Boolean)
      .slice(0, limit);

    result[channel] = merged;
  }

  return result;
}

export function mergePostHashtags(
  channel: MarketingChannelId,
  aiTags: string[] | undefined,
  research: HashtagResearchMap
): string[] {
  const limit = CHANNEL_LIMITS[channel] ?? 5;
  const merged = [
    ...new Set([
      ...(research[channel] ?? []),
      ...(aiTags ?? []).map(normalizeTag).filter(Boolean),
    ]),
  ];
  return merged.slice(0, limit);
}

export function formatHashtagsForPrompt(research: HashtagResearchMap): string {
  return Object.entries(research)
    .map(([ch, tags]) => `${ch}: ${tags.map((t) => `#${t}`).join(" ")}`)
    .join("\n");
}
