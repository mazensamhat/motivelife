import { buildCreativePrompt } from "./app-visuals";
import { getBrandProfile } from "./brands";
import type { ReferenceImageMode } from "./creatives";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export function buildGeminiBrowserPrompt(params: {
  brandId: MarketingBrandId;
  brief: string;
  imagePrompt?: string;
  channel?: MarketingChannelId;
  hasReference?: boolean;
  mode?: ReferenceImageMode;
}): string {
  const promptBase = buildCreativePrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel
  );
  const brand = getBrandProfile(params.brandId);
  const action = params.hasReference
    ? params.mode === "polish"
      ? "EDIT BRIEF: Polish this screenshot into a paid-social still — same UI, better light, brand accent rim, remove status-bar clutter."
      : "EDIT BRIEF: Reimagine this screenshot as a cinematic product ad — same feature, dark navy atmosphere, intentional hero phone/UI."
    : "Create a premium scroll-stopping social creative for this mobile product.";
  return `${action}\n${promptBase}\nBrand: ${brand.name}.\nFollow channel aspect: Instagram/TikTok 9:16, LinkedIn/Facebook 16:9, else 1:1. No watermarks.`;
}
