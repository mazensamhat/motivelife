/** Google AI Studio / Gemini — optional alternative to OpenAI for marketing images. */
export function getGoogleAiApiKey(): string | null {
  const key =
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return key || null;
}

export function getPollinationsApiKey(): string | null {
  return process.env.POLLINATIONS_API_KEY?.trim() || null;
}

export function getCloudflareAiConfig(): { accountId: string; apiToken: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

export function getPuterAuthToken(): string | null {
  return process.env.PUTER_AUTH_TOKEN?.trim() || null;
}

export function getGeminiBrowserWorkerUrl(): string | null {
  return process.env.GEMINI_BROWSER_WORKER_URL?.trim() || null;
}

export function getGeminiBrowserWorkerSecret(): string | undefined {
  return process.env.GEMINI_BROWSER_WORKER_SECRET?.trim() || undefined;
}

export type MarketingImageProvider =
  | "auto"
  | "gemini"
  | "openai"
  | "browser"
  | "pollinations"
  | "cloudflare"
  | "puter";

export type MarketingImageBackend =
  | { provider: "gemini"; apiKey: string }
  | { provider: "openai"; apiKey: string }
  | { provider: "browser-worker"; url: string; secret?: string }
  | { provider: "pollinations"; apiKey?: string }
  | { provider: "cloudflare"; accountId: string; apiToken: string }
  | { provider: "puter"; authToken: string };

export function getMarketingImageProvider(): MarketingImageProvider {
  const raw = process.env.MARKETING_IMAGE_PROVIDER?.trim().toLowerCase();
  const allowed = [
    "gemini",
    "openai",
    "browser",
    "pollinations",
    "cloudflare",
    "puter",
    "auto",
  ] as const;
  if (allowed.includes(raw as (typeof allowed)[number])) {
    return raw as MarketingImageProvider;
  }
  return "auto";
}

export function resolveMarketingImageBackend(): MarketingImageBackend | null {
  const mode = getMarketingImageProvider();
  const gemini = getGoogleAiApiKey();
  const pollinationsKey = getPollinationsApiKey();
  const cloudflare = getCloudflareAiConfig();
  const puter = getPuterAuthToken();
  const workerUrl = getGeminiBrowserWorkerUrl();
  const workerSecret = getGeminiBrowserWorkerSecret();
  const openai =
    process.env.ENABLE_OPENAI !== "false" ? process.env.OPENAI_API_KEY?.trim() : undefined;

  if (mode === "pollinations") {
    return { provider: "pollinations", apiKey: pollinationsKey ?? undefined };
  }
  if (mode === "cloudflare") {
    return cloudflare ? { provider: "cloudflare", ...cloudflare } : null;
  }
  if (mode === "puter") {
    return puter ? { provider: "puter", authToken: puter } : null;
  }
  if (mode === "browser" && workerUrl) {
    return { provider: "browser-worker", url: workerUrl, secret: workerSecret };
  }
  if (mode === "gemini" && gemini) return { provider: "gemini", apiKey: gemini };
  if (mode === "openai" && openai) return { provider: "openai", apiKey: openai };

  if (mode === "auto") {
    if (gemini) return { provider: "gemini", apiKey: gemini };
    if (openai) return { provider: "openai", apiKey: openai };
    if (cloudflare) return { provider: "cloudflare", ...cloudflare };
    if (puter) return { provider: "puter", authToken: puter };
    if (workerUrl) return { provider: "browser-worker", url: workerUrl, secret: workerSecret };
    return { provider: "pollinations", apiKey: pollinationsKey ?? undefined };
  }

  if (mode === "browser" && gemini) return { provider: "gemini", apiKey: gemini };

  return null;
}

export const GEMINI_APP_URL = "https://gemini.google.com/app";
export const GEMINI_BROWSER_WORKER_DEFAULT_URL = "http://127.0.0.1:8765";

export function marketingImageBackendHint(): string {
  const mode = getMarketingImageProvider();
  if (mode === "cloudflare") {
    return "Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in Vercel (Workers AI free tier).";
  }
  if (mode === "puter") {
    return "Set PUTER_AUTH_TOKEN from puter.com/dashboard (free tier uses your Puter credits).";
  }
  if (mode === "pollinations") {
    return "Pollinations flux works with no key; add POLLINATIONS_API_KEY for higher limits.";
  }
  if (mode === "browser") {
    return "Start the Gemini browser worker (pnpm gemini:worker) and set GEMINI_BROWSER_WORKER_URL.";
  }
  return "Set GOOGLE_AI_API_KEY, or use free Pollinations/Cloudflare/Puter — see .env.example.";
}
