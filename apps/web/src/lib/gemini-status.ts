import { getGoogleAiApiKey } from "@/lib/google-ai-config";

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

export function getGeminiImageModel(): string {
  return (
    process.env.GOOGLE_AI_IMAGE_MODEL?.trim() || "gemini-2.0-flash-preview-image-generation"
  );
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
  if (res.status === 429 || errText.includes("RESOURCE_EXHAUSTED")) {
    detail = "Quota exceeded — rate or daily limit hit";
  } else if (res.status === 403 || errText.includes("API_KEY_INVALID")) {
    detail = "Invalid API key";
  } else if (errText.includes("PERMISSION_DENIED")) {
    detail = "Key valid but model access denied";
  } else {
    detail = errText.slice(0, 100) || detail;
  }

  return { ok: false as const, detail };
}

export async function getGeminiPlatformStatus(): Promise<GeminiPlatformStatus> {
  const apiKey = getGoogleAiApiKey();
  const tier = getGeminiTier();
  const tierMeta = TIER_META[tier];
  const imageModel = getGeminiImageModel();
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
  const checklist = [
    { ok: true, label: "GOOGLE_AI_API_KEY set" },
    { ok: verified.ok, label: "API connection OK", detail: verified.detail },
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
    imageModel,
    apiOk: verified.ok,
    summary: verified.ok
      ? `${tierMeta.label} · ${verified.detail}`
      : verified.detail,
    metrics: [
      { label: "Tier", value: tierMeta.label },
      { label: "Rate limit", value: tierMeta.rpm },
      { label: "Daily cap", value: tierMeta.rpd },
      { label: "Billing", value: tierMeta.billing },
      { label: "Image model", value: imageModel },
      { label: "Mode", value: provider },
    ],
    checklist,
  };
}

export const GEMINI_USAGE_URL = "https://aistudio.google.com/app/apikey";
export const GEMINI_RATE_LIMITS_URL = "https://ai.google.dev/gemini-api/docs/rate-limits";
