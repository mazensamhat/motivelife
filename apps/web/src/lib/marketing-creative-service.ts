import { prisma } from "@forward/database";
import {
  generateMarketingImage,
  type MarketingBrandId,
  type MarketingChannelId,
} from "@forward/marketing-agent";
import { getOpenAiApiKey } from "@/lib/openai-config";
import { optimizeMediaBuffer, persistMarketingMedia } from "@/lib/marketing-creatives";
import { serializeMarketingPost } from "@/lib/marketing-agent-service";
import { generateNarrationScript, generateSpeechMp3 } from "@/lib/marketing-voice";

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
    const optimized = await optimizeMediaBuffer(pngBuffer, still.mimeType);

    let narrationData: string | null = null;
    let narrationMimeType: string | null = null;
    let fallbackNote: string | undefined;

    if (kind === "video_5" || kind === "video_30") {
      const durationSec = kind === "video_30" ? 30 : 5;
      const script = await generateNarrationScript(
        { brandId, postBody: post.body, durationSec },
        apiKey
      );
      const audioMp3 = await generateSpeechMp3(script, apiKey);
      narrationData = audioMp3.toString("base64");
      narrationMimeType = "audio/mpeg";
      fallbackNote =
        "Image + AI voiceover ready. Play audio below — combine in CapCut/Instagram Reels for a full video.";
    }

    const stored = await persistMarketingMedia(postId, optimized.buffer, optimized.mimeType);

    const updated = await prisma.marketingPost.update({
      where: { id: postId },
      data: {
        mediaType: "image",
        mediaMimeType: optimized.mimeType,
        mediaUrl: stored.mediaUrl,
        mediaData: stored.mediaData,
        narrationData,
        narrationMimeType,
      },
    });

    const serialized = serializeMarketingPost(updated);
    return {
      ok: true as const,
      post: serialized,
      previewUrl: serialized.mediaPreviewUrl,
      fallbackNote,
    };
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
