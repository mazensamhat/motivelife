import { buildCreativePrompt, getAppVisualKit } from "./app-visuals";
import { getBrandProfile } from "./brands";
import type { GeneratedMedia, ReferenceImageMode } from "./creatives";
import type { MarketingBrandId, MarketingChannelId } from "./types";

const IMAGE_MODEL =
  process.env.GOOGLE_AI_IMAGE_MODEL?.trim() || "gemini-2.0-flash-preview-image-generation";

function aspectHint(channel?: MarketingChannelId): string {
  const kit = getAppVisualKit("motivelife", channel);
  if (kit.aspectRatio === "9:16") return "Vertical 9:16 social story format.";
  if (kit.aspectRatio === "16:9") return "Horizontal 16:9 format.";
  return "Square 1:1 social post format.";
}

async function callGeminiGenerate(
  apiKey: string,
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
): Promise<GeneratedMedia> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini image failed: ${err.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> };
    }>;
  };

  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return {
        mediaType: "image",
        mimeType: part.inlineData.mimeType ?? "image/png",
        base64: part.inlineData.data,
        prompt: parts.find((p) => p.text)?.text ?? "",
        source: "gemini",
      };
    }
  }

  throw new Error("Gemini returned no image — try Browser assist in Ops Console or check GOOGLE_AI_API_KEY.");
}

export async function generateMarketingImageViaGemini(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel?: MarketingChannelId;
  },
  apiKey: string
): Promise<GeneratedMedia> {
  const prompt = buildCreativePrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel
  );
  const brand = getBrandProfile(params.brandId);
  const text = `${prompt}\nBrand: ${brand.name}.\n${aspectHint(params.channel)}\nPremium marketing creative, no watermarks, no fake UI chrome unless requested.`;

  return callGeminiGenerate(apiKey, [{ text }]);
}

export async function generateMarketingImageFromReferenceViaGemini(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel?: MarketingChannelId;
    referenceBase64: string;
    referenceMimeType: string;
    mode: ReferenceImageMode;
  },
  apiKey: string
): Promise<GeneratedMedia> {
  const prompt = buildCreativePrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel
  );
  const brand = getBrandProfile(params.brandId);
  const action =
    params.mode === "polish"
      ? "Polish this app screenshot into a premium social ad — same layout, better lighting and brand gradient accents."
      : "Reimagine this app screenshot as a premium social marketing creative — same feature, cinematic MotiveLife brand look.";
  const text = `${action}\n${prompt}\nBrand: ${brand.name}.\n${aspectHint(params.channel)}`;

  return callGeminiGenerate(apiKey, [
    { text },
    {
      inlineData: {
        mimeType: params.referenceMimeType,
        data: params.referenceBase64,
      },
    },
  ]);
}
