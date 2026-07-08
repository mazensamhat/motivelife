import type { MarketingBrandId, MarketingChannelId } from "./types";

/** Visual DNA pulled from the MotiveLife web app (globals.css, logo, landing copy). */
export type AppVisualKit = {
  brandId: MarketingBrandId;
  logoUrl: string;
  iconUrl: string;
  referenceScreenshots: string[];
  colors: {
    background: string;
    surface: string;
    accent: string;
    gradient: string;
  };
  uiStyle: string;
  heroCopy: string;
  aspectRatio: "1:1" | "9:16" | "16:9";
};

const MOTIVELIFE_VISUALS: Omit<AppVisualKit, "brandId" | "aspectRatio"> = {
  logoUrl: "https://www.mymotivelife.com/brand/motivelife-logo.png",
  iconUrl: "https://www.mymotivelife.com/brand/logo-icon.png",
  referenceScreenshots: [
    "https://www.mymotivelife.com/brand/motivelife-logo.png",
    "https://www.mymotivelife.com/brand/logo-icon.png",
  ],
  colors: {
    background: "#050d18",
    surface: "#0a1930",
    accent: "#00e5ff",
    gradient: "cyan #00e5ff → #00c6ff → lime green #32ff7e",
  },
  uiStyle:
    "Dark premium mobile-first dashboard. Navy background (#050d18), rounded cards, subtle borders, brand gradient accents on CTAs. Clean typography (Inter). Voice-led hero: microphone / waveform motifs. Life Score ring, goal cards, morning briefing panel.",
  heroCopy: "Just talk. Your AI life operating system.",
};

function parseReferenceUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function channelAspect(channel?: MarketingChannelId): AppVisualKit["aspectRatio"] {
  if (channel === "instagram" || channel === "tiktok") return "9:16";
  if (channel === "linkedin" || channel === "facebook") return "16:9";
  return "1:1";
}

export function getAppVisualKit(
  brandId: MarketingBrandId,
  channel?: MarketingChannelId
): AppVisualKit {
  const extraRefs = parseReferenceUrls(process.env.MARKETING_APP_SCREENSHOT_URLS);
  const aspectRatio = channelAspect(channel);

  if (brandId === "motivelife") {
    return {
      brandId,
      aspectRatio,
      ...MOTIVELIFE_VISUALS,
      referenceScreenshots: [...MOTIVELIFE_VISUALS.referenceScreenshots, ...extraRefs],
    };
  }

  if (brandId === "motivefx") {
    return {
      brandId,
      aspectRatio,
      logoUrl: "https://www.motivefxai.com/brand/motivefx-logo.png",
      iconUrl: "https://www.motivefxai.com/brand/motivefx-icon.png",
      referenceScreenshots: extraRefs.length
        ? extraRefs
        : ["https://www.motivefxai.com/brand/motivefx-icon.png"],
      colors: {
        background: "#0b1220",
        surface: "#111827",
        accent: "#22d3ee",
        gradient: "cyan #06b6d4 → blue #3b82f6",
      },
      uiStyle:
        "Professional trading terminal UI. Dark slate dashboard, signal cards, portfolio metrics, market heatmaps, AI advisor panels.",
      heroCopy: "Trade smarter. Move faster. AI market intelligence.",
    };
  }

  return {
    brandId,
    aspectRatio,
    logoUrl: "https://motiveiq.ai/icon.png",
    iconUrl: "https://motiveiq.ai/icon.png",
    referenceScreenshots: extraRefs.length ? extraRefs : ["https://motiveiq.ai/icon.png"],
    colors: {
      background: "#0c1222",
      surface: "#151d2e",
      accent: "#8b5cf6",
      gradient: "violet #7c3aed → blue #3b82f6",
    },
    uiStyle:
      "Consumer automotive intelligence app. Trust-focused UI, vehicle cards, fair-price indicators, maintenance timeline.",
    heroCopy: "Buy and own your car with confidence.",
  };
}

export function buildCreativePrompt(
  brandId: MarketingBrandId,
  brief: string,
  imagePrompt?: string,
  channel?: MarketingChannelId
): string {
  const kit = getAppVisualKit(brandId, channel);
  const scene = imagePrompt?.trim() || brief.trim();

  return [
    `Marketing creative for ${brandId}. Match the real product UI style exactly.`,
    `Scene: ${scene}`,
    `Visual style: ${kit.uiStyle}`,
    `Brand colors: background ${kit.colors.background}, accent ${kit.colors.accent}, gradient ${kit.colors.gradient}.`,
    `Hero message vibe: "${kit.heroCopy}"`,
    `Layout: ${kit.aspectRatio} social post, legible on mobile, no cluttered text blocks.`,
    "Show realistic app UI mockup or lifestyle scene using the product — premium, modern, Canadian tech brand.",
    "No watermarks, no misspelled brand name, no stock-photo clichés.",
  ].join(" ");
}
