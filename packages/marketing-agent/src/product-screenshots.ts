import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export type ProductScreenshotAsset = {
  id: string;
  fileName: string;
  /** Public URL once deployed on MotiveLife web. */
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

function candidateLocalPaths(fileName: string): string[] {
  const roots = [
    process.cwd(),
    join(process.cwd(), "../.."),
    join(process.cwd(), ".."),
  ];
  const rels = [
    join("apps/web/public/marketing/screenshots", fileName),
    join("public/marketing/screenshots", fileName),
    join("packages/marketing-agent/assets/screenshots/motivelife", fileName),
    join("assets/screenshots/motivelife", fileName),
  ];
  const out: string[] = [];
  for (const root of roots) {
    for (const rel of rels) {
      out.push(join(root, rel));
    }
  }
  return out;
}

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

/** Load screenshot bytes from disk (preferred) or public URL fetch. */
export async function loadProductUiScreenshot(
  brandId: MarketingBrandId,
  brief?: string,
  channel?: MarketingChannelId
): Promise<{ base64: string; mimeType: string; url: string; source: "disk" | "url" } | null> {
  if (brandId !== "motivelife") {
    // Other brands: use env URLs only (fetched below via kit).
    return null;
  }

  const asset = pickMotiveLifeScreenshotAsset(brief, channel);

  for (const path of candidateLocalPaths(asset.fileName)) {
    if (!existsSync(path)) continue;
    try {
      const buffer = readFileSync(path);
      if (buffer.byteLength < 1_000) continue;
      return {
        base64: buffer.toString("base64"),
        mimeType: "image/png",
        url: asset.publicUrl,
        source: "disk",
      };
    } catch {
      // try next path
    }
  }

  try {
    const res = await fetch(asset.publicUrl, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    if (!mimeType.startsWith("image/")) return null;
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { base64, mimeType, url: asset.publicUrl, source: "url" };
  } catch {
    return null;
  }
}
