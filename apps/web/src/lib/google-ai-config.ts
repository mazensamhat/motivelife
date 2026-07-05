/** Google AI Studio / Gemini — optional alternative to OpenAI for marketing images. */
export function getGoogleAiApiKey(): string | null {
  const key =
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return key || null;
}

export type MarketingImageProvider = "auto" | "gemini" | "openai" | "browser";

export function getMarketingImageProvider(): MarketingImageProvider {
  const raw = process.env.MARKETING_IMAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "gemini" || raw === "openai" || raw === "browser" || raw === "auto") {
    return raw;
  }
  return "auto";
}

export function resolveMarketingImageBackend():
  | { provider: "gemini"; apiKey: string }
  | { provider: "openai"; apiKey: string }
  | { provider: "browser" }
  | null {
  const mode = getMarketingImageProvider();
  const gemini = getGoogleAiApiKey();
  const openai =
    process.env.ENABLE_OPENAI !== "false" ? process.env.OPENAI_API_KEY?.trim() : undefined;

  if (mode === "browser") return { provider: "browser" };
  if (mode === "gemini" && gemini) return { provider: "gemini", apiKey: gemini };
  if (mode === "openai" && openai) return { provider: "openai", apiKey: openai };
  if (mode === "auto") {
    if (gemini) return { provider: "gemini", apiKey: gemini };
    if (openai) return { provider: "openai", apiKey: openai };
  }
  return null;
}

export const GEMINI_APP_URL = "https://gemini.google.com/app";
