import { prisma } from "@forward/database";
import {
  generateMarketingImage,
  type MarketingBrandId,
  type MarketingChannelId,
} from "@forward/marketing-agent";
import { getOpenAiApiKey } from "@/lib/openai-config";
import {
  optimizeMediaBuffer,
  persistMarketingMedia,
} from "@/lib/marketing-creatives";
import { serializeMarketingPost } from "@/lib/marketing-agent-service";
import { generateNarrationScript, generateSpeechMp3 } from "@/lib/marketing-voice";
import { createNarratedKenBurnsVideo, videoDimensionsForChannel } from "@/lib/marketing-video";

export type CreativeKind = "image" | "video_5" | "video_30";

export async function generatePostCreative(postId: string, kind: CreativeKind) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false as const, error: "Post not found" };
  if (!post.channel) {
    return { ok: false as const, error: "Creatives are only for social posts." };
  }

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { ok: false as const, error: "OPENAI_API_KEY required for image and video generation." };
  }

  const brandId = post.brand as MarketingBrandId;
  const channel = post.channel as MarketingChannelId;
  const brief = post.aiBrief ?? post.body.slice(0, 500);

  try {
    let mediaType: "image" | "gif" | "video" = "image";
    let mimeType = "image/png";
    let buffer: Buffer;

    const still = await generateMarketingImage(
      {
        brandId,
        brief,
        imagePrompt: post.imagePrompt ?? undefined,
        channel,
      },
      apiKey
    );
    const pngBuffer = Buffer.from(still.base64, "base64");

    if (kind === "image") {
      const optimized = await optimizeMediaBuffer(pngBuffer, still.mimeType);
      mediaType = "image";
      mimeType = optimized.mimeType;
      buffer = optimized.buffer;
    } else {
      const durationSec = kind === "video_30" ? 30 : 5;
      const script = await generateNarrationScript(
        { brandId, postBody: post.body, durationSec },
        apiKey
      );
      const audioMp3 = await generateSpeechMp3(script, apiKey);
      const dimensions = videoDimensionsForChannel(channel);
      buffer = await createNarratedKenBurnsVideo(
        pngBuffer,
        audioMp3,
        durationSec,
        dimensions
      );
      mediaType = "video";
      mimeType = "video/mp4";

      if (!process.env.BLOB_READ_WRITE_TOKEN?.trim() && buffer.byteLength > 3_500_000) {
        return {
          ok: false as const,
          error:
            "Video is large — add BLOB_READ_WRITE_TOKEN in Vercel (Settings → Storage → Blob) for MP4 previews and Instagram Reels.",
        };
      }
    }

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

    const serialized = serializeMarketingPost(updated);
    return { ok: true as const, post: serialized, previewUrl: serialized.mediaPreviewUrl };
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
