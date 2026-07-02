import { prisma } from "@forward/database";
import {
  generateMarketingImage,
  generateMarketingVideo,
  type MarketingBrandId,
  type MarketingChannelId,
} from "@forward/marketing-agent";
import { getOpenAiApiKey } from "@/lib/openai-config";
import {
  createKenBurnsGif,
  kenBurnsOptionsForChannel,
  optimizeMediaBuffer,
  persistMarketingMedia,
} from "@/lib/marketing-creatives";
import { serializeMarketingPost } from "@/lib/marketing-agent-service";
import { generateNarrationScript, generateSpeechMp3 } from "@/lib/marketing-voice";

export type CreativeKind = "image" | "animation" | "video_5" | "video_30";

type MediaPayload = {
  buffer: Buffer;
  mimeType: string;
  mediaType: "image" | "gif" | "video";
};

async function generateStillImage(
  post: {
    brand: string;
    channel: string | null;
    body: string;
    imagePrompt: string | null;
    aiBrief: string | null;
  },
  apiKey: string
) {
  const brandId = post.brand as MarketingBrandId;
  const channel = post.channel as MarketingChannelId;
  const brief = post.aiBrief ?? post.body.slice(0, 500);
  const still = await generateMarketingImage(
    {
      brandId,
      brief,
      imagePrompt: post.imagePrompt ?? undefined,
      channel,
    },
    apiKey
  );
  return {
    pngBuffer: Buffer.from(still.base64, "base64"),
    brandId,
    channel,
    brief,
  };
}

async function buildKenBurnsMedia(
  pngBuffer: Buffer,
  channel: MarketingChannelId,
  durationSec: number
): Promise<MediaPayload> {
  const opts = kenBurnsOptionsForChannel(channel, durationSec);
  const gifBuffer = await createKenBurnsGif(pngBuffer, opts);
  return { buffer: gifBuffer, mimeType: "image/gif", mediaType: "gif" };
}

async function tryReplicateMp4(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel: MarketingChannelId;
    imageBase64: string;
  },
  apiKey: string
): Promise<MediaPayload | null> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) return null;

  try {
    const video = await generateMarketingVideo(params, apiKey, token);
    return {
      buffer: Buffer.from(video.base64, "base64"),
      mimeType: video.mimeType,
      mediaType: "video",
    };
  } catch (error) {
    console.warn("[marketing/creative] Replicate video unavailable", error);
    return null;
  }
}

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

  try {
    const { pngBuffer, brandId, channel, brief } = await generateStillImage(post, apiKey);

    let narrationData: string | null = null;
    let narrationMimeType: string | null = null;
    let fallbackNote: string | undefined;
    let media: MediaPayload;

    if (kind === "image") {
      const optimized = await optimizeMediaBuffer(pngBuffer, "image/png");
      media = {
        buffer: optimized.buffer,
        mimeType: optimized.mimeType,
        mediaType: "image",
      };
    } else if (kind === "animation") {
      media = await buildKenBurnsMedia(pngBuffer, channel, 5);
      fallbackNote = "5s Ken Burns animation (GIF) — ready for Stories, posts, or Reels upload.";
    } else {
      const durationSec = kind === "video_30" ? 30 : 5;
      const script = await generateNarrationScript(
        { brandId, postBody: post.body, durationSec },
        apiKey
      );
      const audioMp3 = await generateSpeechMp3(script, apiKey);
      narrationData = audioMp3.toString("base64");
      narrationMimeType = "audio/mpeg";

      if (kind === "video_5") {
        const mp4 = await tryReplicateMp4(
          {
            brandId,
            brief,
            imagePrompt: post.imagePrompt ?? undefined,
            channel,
            imageBase64: pngBuffer.toString("base64"),
          },
          apiKey
        );
        if (mp4) {
          media = mp4;
          fallbackNote =
            "AI MP4 clip ready. Play voiceover below — merge in CapCut/Reels for one file with sound.";
        } else {
          media = await buildKenBurnsMedia(pngBuffer, channel, 5);
          fallbackNote =
            process.env.REPLICATE_API_TOKEN?.trim()
              ? "Animation + voiceover ready (Replicate MP4 failed). Add voice in CapCut, or retry."
              : "Animation + AI voiceover ready. Add REPLICATE_API_TOKEN in Vercel for MP4 clips, or merge in CapCut.";
        }
      } else {
        media = await buildKenBurnsMedia(pngBuffer, channel, 30);
        fallbackNote =
          "30s Ken Burns animation + AI voiceover. Merge in CapCut/Reels for a full narrated video.";
      }
    }

    const stored = await persistMarketingMedia(postId, media.buffer, media.mimeType);

    const updated = await prisma.marketingPost.update({
      where: { id: postId },
      data: {
        mediaType: media.mediaType,
        mediaMimeType: media.mimeType,
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
