import type { MarketingBrandId, MarketingChannelId } from "./types";
import { MOTIVELIFE_PRODUCT_SCREENSHOTS } from "./product-screenshots";

/** Visual DNA pulled from the MotiveLife web app (globals.css, logo, landing copy). */
export type AppVisualKit = {
  brandId: MarketingBrandId;
  logoUrl: string;
  iconUrl: string;
  /** Public product UI screenshot URLs (not logos). Used to condition creatives. */
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

const SITE = "https://www.mymotivelife.com";

const MOTIVELIFE_VISUALS: Omit<AppVisualKit, "brandId" | "aspectRatio"> = {
  logoUrl: `${SITE}/brand/motivelife-logo.png`,
  iconUrl: `${SITE}/brand/logo-icon.png`,
  referenceScreenshots: MOTIVELIFE_PRODUCT_SCREENSHOTS.map((s) => s.publicUrl),
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
  if (channel === "instagram" || channel === "tiktok" || channel === "youtube") return "9:16";
  if (
    channel === "linkedin" ||
    channel === "facebook" ||
    channel === "reddit" ||
    channel === "x" ||
    channel === "threads"
  ) {
    return "16:9";
  }
  return "1:1";
}

function brandScreenshotEnv(brandId: MarketingBrandId): string[] {
  const specific = parseReferenceUrls(
    process.env[`MARKETING_${brandId.toUpperCase()}_APP_SCREENSHOT_URLS`]
  );
  if (specific.length) return specific;
  return parseReferenceUrls(process.env.MARKETING_APP_SCREENSHOT_URLS);
}

export function isProductUiReferenceUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (!lower.startsWith("http")) return false;
  if (/\/favicon|\.svg(\?|$)/.test(lower)) return false;
  if (/\/brand\/[^/]*(logo|icon)[^/]*(\?|$)/.test(lower)) return false;
  if (/logo-icon|logo-full|app-icon|motivelife-logo/.test(lower)) return false;
  return true;
}

export function getAppVisualKit(
  brandId: MarketingBrandId,
  channel?: MarketingChannelId
): AppVisualKit {
  const envRefs = brandScreenshotEnv(brandId).filter(isProductUiReferenceUrl);
  const aspectRatio = channelAspect(channel);

  if (brandId === "motivelife") {
    return {
      brandId,
      aspectRatio,
      ...MOTIVELIFE_VISUALS,
      referenceScreenshots: envRefs.length
        ? envRefs
        : [...MOTIVELIFE_VISUALS.referenceScreenshots],
    };
  }

  if (brandId === "motivefx") {
    return {
      brandId,
      aspectRatio,
      logoUrl: "https://www.motivefxai.com/brand/motivefx-logo.png",
      iconUrl: "https://www.motivefxai.com/brand/motivefx-icon.png",
      referenceScreenshots: envRefs,
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

  if (brandId === "motivepulse") {
    return {
      brandId,
      aspectRatio,
      logoUrl: "https://www.mymotivepulse.com/brand/motivepulse-iq-logo.png",
      iconUrl: "https://www.mymotivepulse.com/brand/motive-plus-iq-icon.svg",
      referenceScreenshots: envRefs,
      colors: {
        background: "#060b14",
        surface: "#0d1524",
        accent: "#D4A853",
        gradient: "gold #F0D78C → #D4A853 → bronze #A67C3D",
      },
      uiStyle:
        "Premium business growth dashboard. Dark navy background, gold accents, Motive Score ring, Google review cards, AI reply drafts, Fix It mission list, competitor gap panels.",
      heroCopy: "Insights. Automation. Growth.",
    };
  }

  return {
    brandId,
    aspectRatio,
    logoUrl: "https://motiveiq.ai/icon.png",
    iconUrl: "https://motiveiq.ai/icon.png",
    referenceScreenshots: envRefs,
    colors: {
      background: "#0c1222",
      surface: "#151d2e",
      accent: "#8b5cf6",
      gradient: "violet #7c3aed → blue #3b82f6",
    },
    uiStyle:
      "Automotive dealership growth intelligence dashboard. Dark premium operator UI, inventory cards, sales pipeline metrics, F&I and service panels, AI growth insights.",
    heroCopy: "AI growth for automotive dealerships.",
  };
}

/** Pick best public product UI screenshot URL for this brief/channel. */
export function pickProductUiScreenshotUrl(
  brandId: MarketingBrandId,
  brief?: string,
  channel?: MarketingChannelId
): string | undefined {
  const kit = getAppVisualKit(brandId, channel);
  const refs = kit.referenceScreenshots.filter(isProductUiReferenceUrl);
  if (!refs.length) return undefined;

  const text = `${brief ?? ""} ${channel ?? ""}`.toLowerCase();
  const byKeyword = (needle: RegExp) => refs.find((url) => needle.test(url.toLowerCase()));

  if (/voice|mic|speak|talk|organiz/.test(text)) {
    return byKeyword(/voice/) ?? refs[0];
  }
  if (/graph|score|domain|habit|life.?feed|money|health|career/.test(text)) {
    return byKeyword(/life-graph|graph|score/) ?? refs[0];
  }
  if (/today|briefing|morning|dashboard/.test(text)) {
    return byKeyword(/today|briefing/) ?? refs[0];
  }
  if (channel === "instagram" || channel === "tiktok") {
    return byKeyword(/voice|today/) ?? refs[0];
  }
  return refs[0];
}

export function buildCreativePrompt(
  brandId: MarketingBrandId,
  brief: string,
  imagePrompt?: string,
  channel?: MarketingChannelId
): string {
  const kit = getAppVisualKit(brandId, channel);
  const scene = imagePrompt?.trim() || brief.trim();
  const picked = pickProductUiScreenshotUrl(brandId, `${brief} ${imagePrompt ?? ""}`, channel);
  const uiRefs = kit.referenceScreenshots.filter(isProductUiReferenceUrl).slice(0, 3);
  const refLine = picked
    ? `Primary product UI reference (match this screen’s layout and chrome): ${picked}.${uiRefs.length > 1 ? ` Other frames: ${uiRefs.filter((u) => u !== picked).slice(0, 2).join(" | ")}.` : ""}`
    : `Match a realistic ${kit.brandId} product UI mockup (not a generic stock lifestyle photo).`;

  return [
    `Premium performance marketing creative for ${getBrandDisplayName(brandId)}. Match the real product UI style exactly.`,
    `Scene: ${scene}`,
    `Visual style: ${kit.uiStyle}`,
    `Brand colors: background ${kit.colors.background}, surface ${kit.colors.surface}, accent ${kit.colors.accent}, gradient ${kit.colors.gradient}.`,
    `Hero message vibe: "${kit.heroCopy}"`,
    refLine,
    `Layout: ${kit.aspectRatio} social post / ad frame, sharp on mobile, high contrast, generous breathing room.`,
    "Cinematic lighting, crisp UI typography, premium Canadian tech brand — not clipart, not stock-photo clichés.",
    "No watermarks, no misspelled brand name, no unreadably tiny fake text blocks, no purple-default AI aesthetic unless brand uses violet.",
  ].join(" ");
}

function getBrandDisplayName(brandId: MarketingBrandId): string {
  if (brandId === "motivepulse") return "MotivePulse IQ";
  if (brandId === "motivefx") return "MotiveFX";
  if (brandId === "motiveiq") return "MotiveIQ";
  return "MotiveLife";
}

export {
  loadProductUiScreenshot,
  pickMotiveLifeScreenshotAsset,
  MOTIVELIFE_PRODUCT_SCREENSHOTS,
} from "./product-screenshots";
