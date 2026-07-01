import { prisma } from "@forward/database";
import {
  generateMarketingImage,
  generateMarketingVideo,
  type MarketingBrandId,
  type MarketingChannelId,
} from "@forward/marketing-agent";
import { getOpenAiApiKey } from "@/lib/openai-config";
import {
  generateKenBurnsAnimation,
  persistMarketingMedia,
} from "@/lib/marketing-creatives";
import { serializeMarketingPost } from "@/lib/marketing-agent-service";

export type CreativeKind = "image" | "animation";

export async function generatePostCreative(postId: string, kind: CreativeKind) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false as const, error: "Post not found" };
  if (!post.channel) {
    return { ok: false as const, error: "Creatives are only for social posts." };
  }

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { ok: false as const, error: "OPENAI_API_KEY required for image generation." };
  }

  const brandId = post.brand as MarketingBrandId;
  const channel = post.channel as MarketingChannelId;
  const brief = post.aiBrief ?? post.body.slice(0, 500);

  try {
    let mediaType: "image" | "gif" | "video" = "image";
    let mimeType = "image/png";
    let base64: string;

    if (kind === "image") {
      const generated = await generateMarketingImage(
        {
          brandId,
          brief,
          imagePrompt: post.imagePrompt ?? undefined,
          channel,
        },
        apiKey
      );
      mediaType = generated.mediaType;
      mimeType = generated.mimeType;
      base64 = generated.base64;
    } else {
      const replicateToken = process.env.REPLICATE_API_TOKEN?.trim();
      if (replicateToken) {
        const generated = await generateMarketingVideo(
          {
            brandId,
            brief,
            imagePrompt: post.imagePrompt ?? undefined,
            channel,
          },
          apiKey,
          replicateToken
        );
        mediaType = generated.mediaType;
        mimeType = generated.mimeType;
        base64 = generated.base64;
      } else {
        const still = await generateMarketingImage(
          {
            brandId,
            brief,
            imagePrompt: post.imagePrompt ?? undefined,
            channel,
          },
          apiKey
        );
        const animated = await generateKenBurnsAnimation(still.base64);
        mediaType = animated.mediaType;
        mimeType = animated.mimeType;
        base64 = animated.base64;
      }
    }

    const buffer = Buffer.from(base64, "base64");
    const stored = await persistMarketingMedia(postId, buffer, mimeType);

    const updated = await prisma.marketingPost.update({
      where: { id: postId },
      data: {
        mediaType,
        mediaMimeType: mimeType,
        mediaUrl: stored.mediaUrl,
        mediaData: stored.mediaData,
      },
    });

    return { ok: true as const, post: serializeMarketingPost(updated) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creative generation failed.";
    return { ok: false as const, error: message };
  }
}

export async function generateCreativesForPosts(
  postIds: string[],
  kind: CreativeKind
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];

  for (const id of postIds) {
    const result = await generatePostCreative(id, kind);
    if (result.ok) created += 1;
    else errors.push(result.error);
  }

  return { created, errors };
}
