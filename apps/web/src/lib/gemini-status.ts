import { getGoogleAiApiKey } from "@/lib/google-ai-config";
import { DEFAULT_GEMINI_IMAGE_MODEL, getGeminiImageModel } from "@forward/marketing-agent";

export type GeminiTier = "free" | "paygo" | "enterprise";

export type GeminiPlatformStatus = {
  configured: boolean;
  tier: GeminiTier;
  tierLabel: string;
  imageModel: string;
  apiOk: boolean;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  checklist: Array<{ ok: boolean; label: string; detail?: string }>;
};

const TIER_META: Record<
  GeminiTier,
  { label: string; rpm: string; rpd: string; billing: string }
> = {
  free: {
    label: "Free (AI Studio)",
    rpm: "~15 RPM / model",
    rpd: "~500–1,500 RPD",
    billing: "No charge within free caps",
  },
  paygo: {
    label: "Pay-as-you-go",
    rpm: "Higher limits",
    rpd: "Metered usage",
    billing: "Billed via Google Cloud",
  },
  enterprise: {
    label: "Enterprise",
    rpm: "Contract limits",
    rpd: "Contract limits",
    billing: "Invoiced contract",
  },
};

export function getGeminiTier(): GeminiTier {
  const raw = process.env.GOOGLE_AI_TIER?.trim().toLowerCase();
  if (raw === "paygo" || raw === "paid" || raw === "pay-as-you-go") return "paygo";
  if (raw === "enterprise") return "enterprise";
  return "free";
}

export function getGeminiImageModelForMonitor(): string {
  return getGeminiImageModel();
}

async function verifyGeminiApiKey(apiKey: string, model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (res.ok) {
    const data = (await res.json()) as { name?: string; displayName?: string };
    return {
      ok: true as const,
      detail: data.displayName ?? data.name ?? model,
    };
  }

  const errText = await res.text();
  let detail = `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(errText) as { error?: { message?: string; code?: number } };
    if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    detail = errText.slice(0, 120) || detail;
  }

  if (res.status === 404 || detail.toLowerCase().includes("not found")) {
    detail = `Model not found — set GOOGLE_AI_IMAGE_MODEL=${DEFAULT_GEMINI_IMAGE_MODEL} in Vercel`;
  } else if (res.status === 429 || detail.includes("RESOURCE_EXHAUSTED")) {
    detail = "Quota exceeded — rate or daily limit hit";
  } else if (res.status === 403 || detail.includes("API_KEY_INVALID")) {
    detail = "Invalid API key";
  } else if (detail.includes("PERMISSION_DENIED")) {
    detail = "Key valid but model access denied";
  }

  return { ok: false as const, detail };
}

export async function getGeminiPlatformStatus(): Promise<GeminiPlatformStatus> {
  const apiKey = getGoogleAiApiKey();
  const tier = getGeminiTier();
  const tierMeta = TIER_META[tier];
  const imageModel = getGeminiImageModelForMonitor();
  const provider = process.env.MARKETING_IMAGE_PROVIDER?.trim() || "auto";

  if (!apiKey) {
    return {
      configured: false,
      tier,
      tierLabel: tierMeta.label,
      imageModel,
      apiOk: false,
      summary: "GOOGLE_AI_API_KEY not set",
      metrics: [
        { label: "Tier", value: tierMeta.label },
        { label: "Image model", value: imageModel },
      ],
      checklist: [{ ok: false, label: "GOOGLE_AI_API_KEY set" }],
    };
  }

  const verified = await verifyGeminiApiKey(apiKey, imageModel);
  const effectiveModel =
    verified.ok || imageModel === DEFAULT_GEMINI_IMAGE_MODEL
      ? imageModel
      : (await verifyGeminiApiKey(apiKey, DEFAULT_GEMINI_IMAGE_MODEL)).ok
        ? DEFAULT_GEMINI_IMAGE_MODEL
        : imageModel;
  const finalVerified =
    effectiveModel !== imageModel
      ? await verifyGeminiApiKey(apiKey, effectiveModel)
      : verified;
  const checklist = [
    { ok: true, label: "GOOGLE_AI_API_KEY set" },
    {
      ok: finalVerified.ok,
      label: "API connection OK",
      detail: finalVerified.detail,
    },
    ...(effectiveModel !== imageModel
      ? [
          {
            ok: true,
            label: `Using fallback model ${effectiveModel}`,
            detail: `Update GOOGLE_AI_IMAGE_MODEL in Vercel (was ${imageModel})`,
          },
        ]
      : []),
    {
      ok: provider === "auto" || provider === "gemini",
      label: `Image mode: ${provider}`,
      detail: provider === "openai" ? "Set MARKETING_IMAGE_PROVIDER=auto or gemini" : undefined,
    },
  ];

  return {
    configured: true,
    tier,
    tierLabel: tierMeta.label,
    imageModel: effectiveModel,
    apiOk: finalVerified.ok,
    summary: finalVerified.ok
      ? `${tierMeta.label} · ${finalVerified.detail}`
      : finalVerified.detail,
    metrics: [
      { label: "Tier", value: tierMeta.label },
      { label: "Rate limit", value: tierMeta.rpm },
      { label: "Daily cap", value: tierMeta.rpd },
      { label: "Billing", value: tierMeta.billing },
      { label: "Image model", value: effectiveModel },
      { label: "Mode", value: provider },
    ],
    checklist,
  };
}

export const GEMINI_USAGE_URL = "https://aistudio.google.com/app/apikey";
export const GEMINI_RATE_LIMITS_URL = "https://ai.google.dev/gemini-api/docs/rate-limits";
