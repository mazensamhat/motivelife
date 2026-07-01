import { buildTrackingUrl, getBrandProfile } from "./brands";
import { getChannel } from "./channels";
import {
  formatHashtagsForPrompt,
  mergePostHashtags,
  researchHashtags,
} from "./hashtags";
import type {
  GenerateMarketingRequest,
  GenerateMarketingResult,
  GeneratedSeoContent,
  GeneratedSocialPost,
  MarketingChannelId,
} from "./types";

const SOCIAL_CHANNELS: MarketingChannelId[] = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
];

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function applyHashtagResearch(
  posts: GeneratedSocialPost[],
  research: Awaited<ReturnType<typeof researchHashtags>>
): GeneratedSocialPost[] {
  return posts.map((p) => ({
    ...p,
    hashtags: mergePostHashtags(p.channel, p.hashtags, research),
  }));
}

function fallbackSocialPosts(
  request: GenerateMarketingRequest,
  research: Awaited<ReturnType<typeof researchHashtags>>
): GeneratedSocialPost[] {
  const brand = getBrandProfile(request.brandId);
  const cta = buildTrackingUrl(request.brandId, "social");

  return request.channels
    .filter((c) => SOCIAL_CHANNELS.includes(c))
    .map((channel) => {
      const max = getChannel(channel).maxLength;
      const hashtags = mergePostHashtags(channel, brand.hashtags, research);
      const tagLine = hashtags.map((h) => `#${h}`).join(" ");
      const body = truncate(
        `${request.brief}\n\n${brand.tagline}\n\n${brand.trialOffer ?? "Learn more"} → ${cta}\n\n${tagLine}`,
        max
      );
      return {
        channel,
        body,
        hashtags,
        ctaUrl: cta,
        imagePrompt: `${brand.name} product screenshot, dark premium UI, minimal`,
      };
    });
}

function fallbackSeo(
  request: GenerateMarketingRequest,
  research: Awaited<ReturnType<typeof researchHashtags>>
): GeneratedSeoContent {
  const brand = getBrandProfile(request.brandId);
  const topic = request.brief.trim() || brand.tagline;
  const title = `${topic} | ${brand.name}`;
  const metaDescription = truncate(
    `${brand.tagline} ${brand.audience.split("—")[0]?.trim() ?? ""}. Built for real life.`,
    155
  );

  return {
    title,
    metaTitle: truncate(title, 60),
    metaDescription,
    keywords: [brand.name, ...brand.hashtags.map((h) => h.toLowerCase())],
    outline: [
      "Problem: fragmented tools and generic AI",
      `Solution: ${brand.name}`,
      "Key benefits",
      "How it works",
      "Get started",
    ],
    body: `# ${title}\n\n${brand.tagline}\n\n${request.brief}\n\nVisit ${brand.siteUrl}`,
    socialSnippets: fallbackSocialPosts(
      { ...request, channels: ["linkedin", "instagram"] },
      research
    ),
  };
}

export async function generateMarketingContent(
  request: GenerateMarketingRequest,
  apiKey?: string | null
): Promise<GenerateMarketingResult> {
  const socialChannelList = request.channels.filter((c) => SOCIAL_CHANNELS.includes(c));
  const hashtagResearch = await researchHashtags(
    request.brandId,
    request.brief,
    socialChannelList
  );

  if (!apiKey?.trim()) {
    return {
      socialPosts: fallbackSocialPosts(request, hashtagResearch),
      seo: request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined,
      adCopy: request.includeAds
        ? [
            `${getBrandProfile(request.brandId).name} — ${request.brief.slice(0, 60)}`,
            getBrandProfile(request.brandId).tagline,
          ]
        : undefined,
    };
  }

  const brand = getBrandProfile(request.brandId);
  const hashtagContext = formatHashtagsForPrompt(hashtagResearch);

  const schema = `{
  "socialPosts": [{ "channel": string, "body": string, "hashtags": string[], "ctaUrl": string, "imagePrompt": string }],
  "seo": { "title": string, "metaTitle": string, "metaDescription": string, "keywords": string[], "outline": string[], "body": string, "socialSnippets": [{ "channel": string, "body": string, "hashtags": string[], "ctaUrl": string }] } | null,
  "adCopy": string[] | null
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Marketing Agent for ${brand.name}. Voice: ${brand.voice}. Audience: ${brand.audience}. Website: ${brand.siteUrl}. Goal: maximize free-trial signups. Output JSON only.`,
        },
        {
          role: "user",
          content: `Brief: ${request.brief}

Channels: ${socialChannelList.join(", ") || "none"}
Include SEO: ${Boolean(request.includeSeo)}
Include Google Ads copy: ${Boolean(request.includeAds)}

Researched hashtags (from web search — prefer these, mix with 1-2 branded tags):
${hashtagContext}

Rules:
- Optimize for signups: clear CTA, pain → solution, mention 14-day free trial when relevant.
- Each social post must fit channel limits (LinkedIn 3000, Instagram/TikTok 2200, Facebook 5000).
- Instagram/TikTok: put hashtags in the hashtags array (not duplicated heavily in body). Use 8-15 IG tags, 3-5 LinkedIn, 1-3 Facebook.
- Use tracking URLs like ${buildTrackingUrl(request.brandId, "CHANNEL")} with correct utm_source per channel.
- SEO metaTitle ≤60 chars, metaDescription ≤155 chars, keywords tuned for Google search intent.
- Ad copy: 3 headlines ≤30 chars, 2 descriptions ≤90 chars each if includeAds.
- LinkedIn: professional tone. Instagram/TikTok: slightly more energetic, still on-brand.

Schema:
${schema}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return {
      socialPosts: fallbackSocialPosts(request, hashtagResearch),
      seo: request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined,
    };
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return {
      socialPosts: fallbackSocialPosts(request, hashtagResearch),
      seo: request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined,
    };
  }

  const parsed = JSON.parse(content) as GenerateMarketingResult;
  const socialPosts = applyHashtagResearch(
    (parsed.socialPosts ?? []).map((p) => ({
      ...p,
      body: truncate(p.body, getChannel(p.channel).maxLength),
      ctaUrl: p.ctaUrl || buildTrackingUrl(request.brandId, p.channel),
    })),
    hashtagResearch
  );

  return {
    socialPosts,
    seo: parsed.seo ?? (request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined),
    adCopy: parsed.adCopy,
  };
}
