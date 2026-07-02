import { prisma } from "@forward/database";
import {
  generateMarketingContent,
  getPublisherStatus,
  publishMarketingPost,
  type GenerateMarketingRequest,
  type MarketingBrandId,
  type MarketingChannelId,
} from "@forward/marketing-agent";
import { getOpenAiApiKey } from "@/lib/openai-config";
import { generateCreativesForPosts } from "@/lib/marketing-creative-service";

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function serializeMarketingPost(post: {
  id: string;
  brand: string;
  channel: string | null;
  kind: string;
  status: string;
  title: string | null;
  body: string;
  hashtags: string | null;
  ctaUrl: string | null;
  imagePrompt: string | null;
  mediaType: string | null;
  mediaMimeType: string | null;
  mediaUrl: string | null;
  mediaData?: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  adCopy: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  externalPostId: string | null;
  publishError: string | null;
  aiBrief: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { mediaData: _omit, ...safe } = post;
  return {
    ...safe,
    hashtags: parseJsonArray(post.hashtags),
    keywords: parseJsonArray(post.keywords),
    adCopy: parseJsonArray(post.adCopy),
    mediaPreviewUrl:
      post.mediaUrl || post.mediaData
        ? `/api/admin/marketing/posts/${post.id}/media?v=${new Date(post.updatedAt).getTime()}`
        : null,
  };
}

export async function listMarketingPosts(limit = 50) {
  const rows = await prisma.marketingPost.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeMarketingPost);
}

export async function generateAndSaveMarketingPosts(
  request: GenerateMarketingRequest,
  createdByEmail: string
) {
  const generated = await generateMarketingContent(request, getOpenAiApiKey());
  const created = [];
  const socialPostIds: string[] = [];

  for (const social of generated.socialPosts) {
    const row = await prisma.marketingPost.create({
      data: {
        brand: request.brandId,
        channel: social.channel,
        kind: "social_post",
        status: "draft",
        body: social.body,
        hashtags: JSON.stringify(social.hashtags),
        ctaUrl: social.ctaUrl,
        imagePrompt: social.imagePrompt ?? null,
        aiBrief: request.brief,
        createdByEmail,
      },
    });
    socialPostIds.push(row.id);
    created.push(serializeMarketingPost(row));
  }

  if (request.generateMedia && socialPostIds.length > 0) {
    const kind =
      request.mediaKind === "video_30"
        ? "video_30"
        : request.mediaKind === "video_5" || request.mediaKind === "animation"
          ? "video_5"
          : "image";
    const mediaResult = await generateCreativesForPosts(socialPostIds, kind);
    if (mediaResult.created > 0) {
      const refreshed = await prisma.marketingPost.findMany({
        where: { id: { in: socialPostIds } },
      });
      for (const row of refreshed) {
        const idx = created.findIndex((p) => p.id === row.id);
        if (idx >= 0) created[idx] = serializeMarketingPost(row);
      }
    }
  }

  if (generated.seo) {
    const seo = generated.seo;
    const row = await prisma.marketingPost.create({
      data: {
        brand: request.brandId,
        channel: "google_search",
        kind: "seo_page",
        status: "draft",
        title: seo.title,
        body: seo.body,
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription,
        keywords: JSON.stringify(seo.keywords),
        aiBrief: request.brief,
        createdByEmail,
      },
    });
    created.push(serializeMarketingPost(row));
  }

  if (generated.adCopy?.length) {
    const row = await prisma.marketingPost.create({
      data: {
        brand: request.brandId,
        channel: "google_ads",
        kind: "ad_copy",
        status: "draft",
        body: generated.adCopy.join("\n---\n"),
        adCopy: JSON.stringify(generated.adCopy),
        aiBrief: request.brief,
        createdByEmail,
      },
    });
    created.push(serializeMarketingPost(row));
  }

  return { posts: created, publisherStatus: getPublisherStatus() };
}

export async function publishMarketingPostById(id: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id } });
  if (!post) return { ok: false as const, error: "Post not found" };
  if (!post.channel) return { ok: false as const, error: "SEO posts are not published via social APIs" };

  await prisma.marketingPost.update({
    where: { id },
    data: { status: "publishing" },
  });

  const result = await publishMarketingPost({
    brandId: post.brand as MarketingBrandId,
    channel: post.channel as MarketingChannelId,
    body: post.body,
    hashtags: parseJsonArray(post.hashtags),
    ctaUrl: post.ctaUrl ?? undefined,
    title: post.title ?? undefined,
    metaTitle: post.metaTitle ?? undefined,
    metaDescription: post.metaDescription ?? undefined,
    mediaUrl: post.mediaUrl ?? undefined,
    mediaType: (post.mediaType as "image" | "gif" | "video" | null) ?? undefined,
  });

  if (result.ok) {
    await prisma.marketingPost.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        externalPostId: result.externalId,
        publishError: null,
      },
    });
    return { ok: true as const, mode: result.mode, externalId: result.externalId };
  }

  await prisma.marketingPost.update({
    where: { id },
    data: {
      status: result.mode === "manual" ? "draft" : "failed",
      publishError: result.error,
    },
  });

  return {
    ok: false as const,
    error: result.error,
    mode: result.mode,
    manualText: result.manualText,
  };
}

export async function scheduleMarketingPost(id: string, scheduledAt: Date) {
  return prisma.marketingPost.update({
    where: { id },
    data: { status: "scheduled", scheduledAt },
  });
}

export async function getMarketingAgentMeta() {
  return { publisherStatus: getPublisherStatus() };
}
