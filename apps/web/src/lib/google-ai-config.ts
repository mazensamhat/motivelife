/** Google AI Studio / Gemini — optional alternative to OpenAI for marketing images. */
export function getGoogleAiApiKey(): string | null {
  const key =
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return key || null;
}

export function getGeminiBrowserWorkerUrl(): string | null {
  return process.env.GEMINI_BROWSER_WORKER_URL?.trim() || null;
}

export function getGeminiBrowserWorkerSecret(): string | undefined {
  return process.env.GEMINI_BROWSER_WORKER_SECRET?.trim() || undefined;
}

export type MarketingImageProvider = "auto" | "gemini" | "openai" | "browser";

export type MarketingImageBackend =
  | { provider: "gemini"; apiKey: string }
  | { provider: "openai"; apiKey: string }
  | { provider: "browser-worker"; url: string; secret?: string };

export function getMarketingImageProvider(): MarketingImageProvider {
  const raw = process.env.MARKETING_IMAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "gemini" || raw === "openai" || raw === "browser" || raw === "auto") {
    return raw;
  }
  return "auto";
}

export function resolveMarketingImageBackend(): MarketingImageBackend | null {
  const mode = getMarketingImageProvider();
  const gemini = getGoogleAiApiKey();
  const workerUrl = getGeminiBrowserWorkerUrl();
  const workerSecret = getGeminiBrowserWorkerSecret();
  const openai =
    process.env.ENABLE_OPENAI !== "false" ? process.env.OPENAI_API_KEY?.trim() : undefined;

  if (mode === "browser" && workerUrl) {
    return { provider: "browser-worker", url: workerUrl, secret: workerSecret };
  }
  if (mode === "gemini" && gemini) return { provider: "gemini", apiKey: gemini };
  if (mode === "openai" && openai) return { provider: "openai", apiKey: openai };
  if (mode === "auto") {
    if (gemini) return { provider: "gemini", apiKey: gemini };
    if (workerUrl) return { provider: "browser-worker", url: workerUrl, secret: workerSecret };
    if (openai) return { provider: "openai", apiKey: openai };
  }
  if (mode === "browser" && gemini) return { provider: "gemini", apiKey: gemini };
  return null;
}

export const GEMINI_APP_URL = "https://gemini.google.com/app";
export const GEMINI_BROWSER_WORKER_DEFAULT_URL = "http://127.0.0.1:8765";

export function marketingImageBackendHint(): string {
  const mode = getMarketingImageProvider();
  if (mode === "browser") {
    return "Start the Gemini browser worker (pnpm gemini:worker) and set GEMINI_BROWSER_WORKER_URL. Production admin needs a tunnel to your PC or use GOOGLE_AI_API_KEY on Vercel.";
  }
  return "Set GOOGLE_AI_API_KEY (fastest on Vercel) or run pnpm gemini:login && pnpm gemini:worker with GEMINI_BROWSER_WORKER_URL.";
}
