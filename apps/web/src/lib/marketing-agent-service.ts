import {
  defaultPublishFormat,
  defaultPublishPrivacy,
} from "@/lib/marketing-publish-options";
import {
  marketingDestinationUrl,
  marketingHopUrl,
  publishedPermalink,
} from "@/lib/marketing-attribution";
import { seoPostPublicUrl } from "@/lib/seo-blog";
import { publishSeoPostToSite } from "@/lib/seo-publish";
import { getOpenAiApiKey } from "@/lib/openai-config";
import { generatePostCreative, type CreativeKind } from "@/lib/marketing-creative-service";
import { prisma } from "@forward/database";
import {
  generateMarketingContent,
  getPublisherStatus,
  publishMarketingPost,
  type GenerateMarketingRequest,
  type MarketingBrandId,
  type MarketingChannelId,
} from "@forward/marketing-agent";

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
  destinationUrl?: string | null;
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
  publishedUrl?: string | null;
  publishError: string | null;
  aiBrief: string | null;
  sourceImageData?: string | null;
  sourceImageMimeType?: string | null;
  sourceImageMode?: string | null;
  publishFormat?: string | null;
  publishPrivacy?: string | null;
  metricImpressions?: number | null;
  metricEngagements?: number | null;
  metricClicks?: number | null;
  metricsSyncedAt?: Date | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { mediaData: _media, narrationData: _narration, sourceImageData: _source, ...safe } = post;
  return {
    ...safe,
    publishFormat: post.publishFormat ?? null,
    publishPrivacy: post.publishPrivacy ?? null,
    destinationUrl: post.destinationUrl ?? null,
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
    publishedUrl: post.publishedUrl ?? (post.slug ? seoPostPublicUrl(post.slug) : null),
    metricImpressions: post.metricImpressions ?? null,
    metricEngagements: post.metricEngagements ?? null,
    metricClicks: post.metricClicks ?? null,
    metricsSyncedAt: post.metricsSyncedAt ?? null,
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
  let generated;
  try {
    generated = await generateMarketingContent(request, getOpenAiApiKey());
  } catch (error) {
    console.error("[marketing/generate] content generation failed", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "AI draft generation failed. Try fewer channels or remove the screenshot."
    );
  }

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
        title: social.title ?? null,
        hashtags: JSON.stringify(social.hashtags),
        ctaUrl: social.ctaUrl,
        imagePrompt: social.imagePrompt ?? null,
        aiBrief: request.brief,
        publishFormat: defaultPublishFormat(social.channel),
        publishPrivacy: defaultPublishPrivacy(social.channel),
        createdByEmail,
      },
    });

    const destinationUrl = marketingDestinationUrl(
      request.brandId,
      social.channel,
      row.id
    );
    const hopUrl = marketingHopUrl(row.id);
    const withHop = await prisma.marketingPost.update({
      where: { id: row.id },
      data: {
        destinationUrl,
        ctaUrl: hopUrl,
      },
    });

    socialPostIds.push(withHop.id);
    created.push(serializeMarketingPost(withHop));
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
        : request.mediaKind === "video_15"
          ? "video_15"
          : request.mediaKind === "video_5"
            ? "video_5"
            : request.mediaKind === "animation"
              ? "animation"
              : "image";

    if (kind === "video_5" || kind === "video_15" || kind === "video_30") {
      return {
        posts: created,
        publisherStatus: getPublisherStatus(),
        mediaWarning:
          "Drafts saved. Video takes a few minutes per post — use 5s / 15s / 30s video on each draft below.",
      };
    }

    // Save text drafts first; bulk image generation is slow and often times out.
    if (socialPostIds.length > 1 || request.referenceImage?.base64) {
      return {
        posts: created,
        publisherStatus: getPublisherStatus(),
        mediaWarning:
          "Drafts saved with your screenshot. Click Image on each draft below to generate art (one at a time).",
      };
    }

    const warnings: string[] = [];
    try {
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
    } catch (error) {
      console.warn("[marketing/generate] bulk creative failed", error);
      warnings.push("Image generation failed — use Image on the draft below.");
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

export async function publishMarketingPostById(
  id: string,
  opts?: { scheduleDate?: string }
) {
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

  const scheduleDate = opts?.scheduleDate?.trim() || undefined;
  const scheduledFor = scheduleDate ? new Date(scheduleDate) : null;
  if (scheduleDate && scheduledFor && Number.isNaN(scheduledFor.getTime())) {
    return { ok: false as const, error: "Invalid scheduleDate." };
  }
  if (scheduledFor && scheduledFor.getTime() <= Date.now()) {
    return { ok: false as const, error: "scheduleDate must be in the future." };
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
    scheduleDate,
    publishFormat: post.publishFormat ?? defaultPublishFormat(post.channel) ?? undefined,
    publishPrivacy:
      (post.publishPrivacy as "public" | "unlisted" | "private" | null) ??
      (defaultPublishPrivacy(post.channel) as "public" | "unlisted" | "private" | null) ??
      undefined,
  });

  if (result.ok) {
    const isScheduled = Boolean(scheduleDate);
    const permalink =
      ("publishedUrl" in result && typeof result.publishedUrl === "string"
        ? result.publishedUrl
        : null) || publishedPermalink(post.channel, result.externalId);
    await prisma.marketingPost.update({
      where: { id },
      data: {
        status: isScheduled ? "scheduled" : "published",
        scheduledAt: isScheduled ? scheduledFor : null,
        publishedAt: isScheduled ? null : new Date(),
        externalPostId: result.externalId,
        publishedUrl: permalink,
        publishError: null,
        // Ensure hop CTA exists even for older drafts.
        ...(post.destinationUrl
          ? {}
          : {
              destinationUrl: marketingDestinationUrl(
                post.brand as MarketingBrandId,
                post.channel,
                post.id
              ),
              ctaUrl: marketingHopUrl(post.id),
            }),
      },
    });
    return {
      ok: true as const,
      mode: result.mode,
      externalId: result.externalId,
      scheduled: isScheduled,
      publishedUrl: permalink ?? undefined,
    };
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

export async function updateMarketingPostPublishOptions(
  id: string,
  opts: { publishFormat?: string; publishPrivacy?: string | null }
) {
  const post = await prisma.marketingPost.findUnique({ where: { id } });
  if (!post) return { ok: false as const, error: "Post not found" };

  const updated = await prisma.marketingPost.update({
    where: { id },
    data: {
      ...(opts.publishFormat !== undefined ? { publishFormat: opts.publishFormat } : {}),
      ...(opts.publishPrivacy !== undefined ? { publishPrivacy: opts.publishPrivacy } : {}),
    },
  });
  return { ok: true as const, post: serializeMarketingPost(updated) };
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
