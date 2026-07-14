import type { MarketingBrandId, MarketingChannelId } from "./types";

export type ProductScreenshotAsset = {
  id: string;
  fileName: string;
  /** Public URL on MotiveLife web (static CDN path — not bundled into serverless). */
  publicUrl: string;
  keywords: string[];
};

const SITE = "https://www.mymotivelife.com";

export const MOTIVELIFE_PRODUCT_SCREENSHOTS: ProductScreenshotAsset[] = [
  {
    id: "today",
    fileName: "phone-01-today.png",
    publicUrl: `${SITE}/marketing/screenshots/phone-01-today.png`,
    keywords: ["today", "briefing", "morning", "dashboard", "welcome"],
  },
  {
    id: "voice",
    fileName: "phone-02-voice.png",
    publicUrl: `${SITE}/marketing/screenshots/phone-02-voice.png`,
    keywords: ["voice", "mic", "speak", "talk", "organiz", "transcri"],
  },
  {
    id: "life-graph",
    fileName: "phone-03-life-graph.png",
    publicUrl: `${SITE}/marketing/screenshots/phone-03-life-graph.png`,
    keywords: ["graph", "score", "domain", "habit", "money", "health", "career", "life feed"],
  },
];

export function pickMotiveLifeScreenshotAsset(
  brief?: string,
  channel?: MarketingChannelId
): ProductScreenshotAsset {
  const text = `${brief ?? ""} ${channel ?? ""}`.toLowerCase();
  for (const asset of MOTIVELIFE_PRODUCT_SCREENSHOTS) {
    if (asset.keywords.some((k) => text.includes(k))) return asset;
  }
  if (channel === "instagram" || channel === "tiktok") {
    return MOTIVELIFE_PRODUCT_SCREENSHOTS[1] ?? MOTIVELIFE_PRODUCT_SCREENSHOTS[0]!;
  }
  return MOTIVELIFE_PRODUCT_SCREENSHOTS[0]!;
}

/**
 * Fetch product UI screenshot over HTTPS from the public site.
 * Never reads from disk — cwd-based fs tracing blows past Vercel’s 250MB function limit.
 */
export async function loadProductUiScreenshot(
  brandId: MarketingBrandId,
  brief?: string,
  channel?: MarketingChannelId
): Promise<{ base64: string; mimeType: string; url: string; source: "url" } | null> {
  if (brandId !== "motivelife") {
    return null;
  }

  const asset = pickMotiveLifeScreenshotAsset(brief, channel);
  const urls = [
    asset.publicUrl,
    // Local/preview: same-origin path when site host differs (still HTTP, not fs).
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/marketing/screenshots/${asset.fileName}`
      : null,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "image/*" },
        signal: AbortSignal.timeout(20_000),
        // Screenshots are static public assets; allow edge/CDN caching.
        cache: "force-cache",
      });
      if (!res.ok) continue;
      const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
      if (!mimeType.startsWith("image/")) continue;
      const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      if (!base64) continue;
      return { base64, mimeType, url, source: "url" };
    } catch {
      // try next URL
    }
  }

  return null;
}
