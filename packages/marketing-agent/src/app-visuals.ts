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

function channelFrameDirection(channel?: MarketingChannelId): string {
  if (channel === "instagram" || channel === "tiktok" || channel === "youtube") {
    return "Vertical 9:16 Reels frame. Hero product UI fills the middle third; top/bottom safe zones stay clean for captions. One phone (or UI panel) dominant — no collage grids.";
  }
  if (channel === "linkedin" || channel === "facebook") {
    return "16:9 landscape feed ad. Product UI left or center; leave breathing room for a short benefit line. Look like paid social, not a raw App Store dump.";
  }
  if (channel === "x" || channel === "threads") {
    return "1:1 or 16:9 feed card. Bold single focal moment, readable at thumbnail size.";
  }
  return "Square 1:1 social card. One clear subject, high thumbnails contrast.";
}

function featureBeat(brief: string, imagePrompt: string | undefined, brandId: MarketingBrandId): string {
  const text = `${brief} ${imagePrompt ?? ""}`.toLowerCase();
  if (brandId === "motivelife") {
    if (/voice|mic|speak|talk|organiz/.test(text)) {
      return "Feature beat: Voice Organize — mic / waveform / speak-to-capture moment that turns speech into planned life actions.";
    }
    if (/graph|score|domain|habit|life.?feed/.test(text)) {
      return "Feature beat: Life Graph / Life Score — radial or domain progress showing career, money, health, habits in one calm view.";
    }
    if (/today|briefing|morning/.test(text)) {
      return "Feature beat: Today / morning briefing — prioritized day plan with Life Score cue and next actions.";
    }
    return "Feature beat: AI life OS — calm dark dashboard that turns talk into a clear day (goals, briefing, Life Score).";
  }
  if (brandId === "motivefx") {
    return "Feature beat: trading terminal — ranked signals, portfolio context, and market flow on one dark screen.";
  }
  if (brandId === "motivepulse") {
    return "Feature beat: Motive Score + review inbox — reputation clarity that drives replies and growth.";
  }
  return "Feature beat: dealer growth intelligence — pipelines, inventory, and ops clarity on one operator dashboard.";
}

function compositionRules(brandId: MarketingBrandId): string {
  const brandLabel = getBrandDisplayName(brandId);
  return [
    "Composition:",
    `- Subject: realistic ${brandLabel} product UI (phone mock or floating UI panel), authentic chrome matching brand style.`,
    "- Lighting: soft key light + cyan/accent rim, deep navy negative space, subtle depth of field — cinematic product shot, not flat flat-illustration.",
    "- Typography in-frame: only large readable brand / CTA words if needed; NEVER invent tiny illegible UI paragraphs.",
    "- Atmosphere: premium Canadian tech — confident, calm, conversion-minded.",
  ].join(" ");
}

function avoidRules(brandId: MarketingBrandId): string {
  const extra =
    brandId === "motivelife"
      ? "No stock yoga/laptop clichés, no neon cyberpunk city, no generic chatbot bubbles as the whole creative."
      : brandId === "motivefx"
        ? "No car dealership imagery, no life-coach aesthetic, no meme-coin cartoon charts."
        : brandId === "motivepulse"
          ? "No life-coach habits UI, no trading candlesticks, no purple SaaS tropes."
          : "No consumer car-shopping stock photos, no crypto charts.";

  return [
    "Avoid:",
    "watermarks, misspelled brand name, purple-on-white default AI look (unless brand is MotiveIQ violet), cluttered multi-phone collages,",
    "fake OS status bars as the hero, unreadably tiny paragraph text, lorem ipsum,",
    extra,
  ].join(" ");
}

/**
 * Shot script for still images (and the visual base of video).
 * Used by OpenAI / Gemini / Pollinations / reference edits.
 */
export function buildCreativePrompt(
  brandId: MarketingBrandId,
  brief: string,
  imagePrompt?: string,
  channel?: MarketingChannelId
): string {
  const kit = getAppVisualKit(brandId, channel);
  const brandName = getBrandDisplayName(brandId);
  const scene = (imagePrompt?.trim() || brief.trim()).replace(/\s+/g, " ").slice(0, 900);
  const picked = pickProductUiScreenshotUrl(brandId, `${brief} ${imagePrompt ?? ""}`, channel);
  const uiRefs = kit.referenceScreenshots.filter(isProductUiReferenceUrl).slice(0, 3);
  const refLine = picked
    ? `Primary UI reference (match this screen’s layout & chrome): ${picked}.${
        uiRefs.length > 1
          ? ` Supporting frames: ${uiRefs.filter((u) => u !== picked).slice(0, 2).join(" | ")}.`
          : ""
      }`
    : `Invent a realistic ${brandName} product UI that matches Visual style below — not a generic stock photo.`;

  return [
    `SHOT SCRIPT — Premium ${brandName} performance creative for ${channel ?? "social"}.`,
    `Hook/scene: ${scene}`,
    featureBeat(brief, imagePrompt, brandId),
    `Visual style: ${kit.uiStyle}`,
    `Palette: bg ${kit.colors.background}, surface ${kit.colors.surface}, accent ${kit.colors.accent}, gradient ${kit.colors.gradient}.`,
    `Brand vibe: "${kit.heroCopy}"`,
    refLine,
    channelFrameDirection(channel),
    `Aspect: ${kit.aspectRatio}.`,
    compositionRules(brandId),
    avoidRules(brandId),
    "Goal: stop the scroll, prove the product is real, invite a trial — look like a top-tier app growth ad.",
  ].join("\n");
}

/**
 * Motion script layered on the still shot for Replicate image-to-video.
 * Keeps UI readable (I2V models warp text if motion is too wild).
 */
export function buildVideoMotionPrompt(
  brandId: MarketingBrandId,
  brief: string,
  imagePrompt?: string,
  channel?: MarketingChannelId,
  durationSec: 5 | 30 = 5
): string {
  const still = buildCreativePrompt(brandId, brief, imagePrompt, channel);
  const long = durationSec >= 20;
  const motion = long
    ? [
        "MOTION (under ~8s, keep UI stable):",
        "Slow cinematic push-in toward the product UI;",
        "subtle parallax on dark navy background;",
        "soft accent glow pulse on primary CTA / score ring;",
        "micro particle dust in negative space only;",
        "NO morphing faces, NO warping text, NO rapid cuts, NO chaotic camera shake.",
      ].join(" ")
    : [
        "MOTION (≈5s Reels loop):",
        "Gentle 5–8% dolly-in on the phone/UI;",
        "light cyan rim glow breathe once;",
        "UI cards stay sharp and readable;",
        "background depth only — never distort logo or headline text;",
        "smooth ease-in/out, premium app commercial energy.",
      ].join(" ");

  const audioCue =
    "Silent clip (no on-screen karaoke captions). Leave lower third clean for native IG/FB captions.";

  return `${still}\n${motion}\n${audioCue}`;
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
