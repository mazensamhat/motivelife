import { buildCreativePrompt, getAppVisualKit } from "./app-visuals";
import { getBrandProfile } from "./brands";
import type { GeneratedMedia, ReferenceImageMode } from "./creatives";
import type { MarketingBrandId, MarketingChannelId } from "./types";

/** Replaced deprecated gemini-2.0-flash-preview-image-generation (shutdown Nov 2025). */
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

const FALLBACK_GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image",
] as const;

export function getGeminiImageModel(): string {
  return process.env.GOOGLE_AI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
}

function geminiImageModelCandidates(): string[] {
  const configured = process.env.GOOGLE_AI_IMAGE_MODEL?.trim();
  const models = configured
    ? [configured, ...FALLBACK_GEMINI_IMAGE_MODELS]
    : [...FALLBACK_GEMINI_IMAGE_MODELS];
  return [...new Set(models)];
}

function aspectHint(channel?: MarketingChannelId): string {
  const kit = getAppVisualKit("motivelife", channel);
  if (kit.aspectRatio === "9:16") return "Vertical 9:16 social story format.";
  if (kit.aspectRatio === "16:9") return "Horizontal 16:9 format.";
  return "Square 1:1 social post format.";
}

async function callGeminiGenerateWithModel(
  model: string,
  apiKey: string,
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
): Promise<GeneratedMedia> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
    const error = new Error(`Gemini image failed (${model}): ${err.slice(0, 400)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
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

  throw new Error(`Gemini (${model}) returned no image.`);
}

async function callGeminiGenerate(
  apiKey: string,
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
): Promise<GeneratedMedia> {
  const models = geminiImageModelCandidates();
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await callGeminiGenerateWithModel(model, apiKey, parts);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = (error as Error & { status?: number }).status;
      if (status === 404 && models.indexOf(model) < models.length - 1) continue;
      if (lastError.message.includes("not found") && models.indexOf(model) < models.length - 1) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Gemini image generation failed.");
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
