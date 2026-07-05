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
      ? "Polish this app screenshot into a premium social ad — same layout, better lighting and brand gradient accents."
      : "Reimagine this app screenshot as a premium social marketing creative — same feature, cinematic brand look."
    : "Create a premium social marketing image for this mobile app.";
  return `${action}\n${promptBase}\nBrand: ${brand.name}.\nSquare 1:1 social post unless the channel needs 9:16. No watermarks.`;
}
