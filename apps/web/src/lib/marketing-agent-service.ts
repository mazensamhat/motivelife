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
import { generatePostCreative, type CreativeKind } from "@/lib/marketing-creative-service";
import { seoPostPublicUrl } from "@/lib/seo-blog";
import { publishSeoPostToSite } from "@/lib/seo-publish";

async function saveSourceReferenceImage(
  postId: string,
  base64: string,
  mimeType: string,
  mode: "reimagine" | "polish"
) {
  const updated = await prisma.marketingPost.update({
    where: { id: postId },
    data: {
      sourceImageData: base64,
      sourceImageMimeType: mimeType,
      sourceImageMode: mode,
    },
  });
  return serializeMarketingPost(updated);
}

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
  mediaBlobPath?: string | null;
  mediaData?: string | null;
  narrationData?: string | null;
  narrationMimeType?: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  adCopy: string | null;
  slug: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  externalPostId: string | null;
  publishError: string | null;
  aiBrief: string | null;
  sourceImageData?: string | null;
  sourceImageMimeType?: string | null;
  sourceImageMode?: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { mediaData: _media, narrationData: _narration, sourceImageData: _source, ...safe } = post;
  return {
    ...safe,
    hashtags: parseJsonArray(post.hashtags),
    keywords: parseJsonArray(post.keywords),
    adCopy: parseJsonArray(post.adCopy),
    hasSourceScreenshot: Boolean(post.sourceImageData),
    mediaPreviewUrl:
      post.mediaUrl || post.mediaData || post.mediaBlobPath
        ? `/api/admin/marketing/posts/${post.id}/media?v=${new Date(post.updatedAt).getTime()}`
        : null,
    narrationPreviewUrl: post.narrationData
      ? `/api/admin/marketing/posts/${post.id}/narration?v=${new Date(post.updatedAt).getTime()}`
      : null,
    publishedUrl: post.slug ? seoPostPublicUrl(post.slug) : null,
  };
}

export async function listMarketingPosts(limit = 30) {
  const rows = await prisma.marketingPost.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeMarketingPost);
}

export async function deleteMarketingPost(id: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id } });
  if (!post) return { ok: false as const, error: "Post not found" };
  await prisma.marketingPost.delete({ where: { id } });
  return { ok: true as const };
}

export async function deleteMarketingDrafts() {
  const result = await prisma.marketingPost.deleteMany({
    where: { status: "draft" },
  });
  return { ok: true as const, deleted: result.count };
}

export async function generateAndSaveMarketingPosts(
  request: GenerateMarketingRequest,
  createdByEmail: string
) {
  const generated = await generateMarketingContent(request, getOpenAiApiKey());
  const created: ReturnType<typeof serializeMarketingPost>[] = [];
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

  if (request.referenceImage?.base64 && socialPostIds.length > 0) {
    const { base64, mimeType } = request.referenceImage;
    const mode = request.referenceImageMode ?? "reimagine";
    for (let i = 0; i < socialPostIds.length; i++) {
      try {
        const serialized = await saveSourceReferenceImage(
          socialPostIds[i]!,
          base64,
          mimeType,
          mode
        );
        const idx = created.findIndex((p) => p.id === socialPostIds[i]);
        if (idx >= 0) created[idx] = serialized;
      } catch (error) {
        console.warn("[marketing/generate] reference image save failed", error);
      }
    }
  }

  if (request.generateMedia && socialPostIds.length > 0) {
    const kind: CreativeKind =
      request.mediaKind === "video_30"
        ? "video_30"
        : request.mediaKind === "video_5"
          ? "video_5"
          : request.mediaKind === "animation"
            ? "animation"
            : "image";

    if (kind === "video_5" || kind === "video_30") {
      return {
        posts: created,
        publisherStatus: getPublisherStatus(),
        mediaWarning:
          "Drafts saved. Video takes 3–5 minutes per post — use 5s/30s video on each draft below (not during bulk generate).",
      };
    }

    const warnings: string[] = [];
    for (const id of socialPostIds) {
      const mediaResult = await generatePostCreative(id, kind, request.imageProvider);
      if (mediaResult.ok && mediaResult.post) {
        const idx = created.findIndex((p) => p.id === id);
        if (idx >= 0) created[idx] = mediaResult.post;
      } else if (!mediaResult.ok) {
        const channel = created.find((p) => p.id === id)?.channel ?? "post";
        warnings.push(`${channel}: ${mediaResult.error}`);
      }
    }

    if (warnings.length > 0) {
      return {
        posts: created,
        publisherStatus: getPublisherStatus(),
        mediaWarning: warnings.join(" "),
      };
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

  if (
    post.channel === "google_search" ||
    post.kind === "seo_page" ||
    post.kind === "seo_blog"
  ) {
    return publishSeoPostToSite(post);
  }

  if (!post.channel) {
    return { ok: false as const, error: "This post type cannot be published." };
  }

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
    return { ok: true as const, mode: result.mode, externalId: result.externalId, publishedUrl: "publishedUrl" in result ? result.publishedUrl : undefined };
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
  const {
    getMarketingImageProvider,
    listMarketingImageProviderOptions,
    resolveMarketingImageBackend,
  } = await import("@/lib/google-ai-config");

  const activeBackend = resolveMarketingImageBackend();

  return {
    publisherStatus: getPublisherStatus(),
    imageProviders: listMarketingImageProviderOptions(),
    defaultImageProvider: getMarketingImageProvider(),
    activeImageProvider: activeBackend?.provider ?? null,
  };
}
