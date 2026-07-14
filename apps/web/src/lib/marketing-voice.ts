import { getBrandProfile } from "@forward/marketing-agent";
import type { MarketingBrandId } from "@forward/marketing-agent";

export async function generateNarrationScript(
  params: {
    brandId: MarketingBrandId;
    postBody: string;
    durationSec: 5 | 30;
    brief?: string | null;
  },
  apiKey: string
): Promise<string> {
  const brand = getBrandProfile(params.brandId);
  const wordTarget = params.durationSec === 5 ? "12-18 words" : "70-95 words";
  const model = process.env.MARKETING_NARRATION_MODEL?.trim() || "gpt-4o";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: `You write premium voiceover scripts for ${brand.name} social ads and Reels.
Voice: ${brand.voice}
Audience: ${brand.audience}
Offer: ${brand.trialOffer ?? brand.siteUrl}
Output plain spoken text only — no quotes, hashtags, emoji, or stage directions.
Structure: hook → one concrete product benefit → soft CTA.`,
        },
        {
          role: "user",
          content: `Write a ${params.durationSec}-second narration (${wordTarget}).

Brief: ${params.brief?.trim() || "(use post)"}
Post copy:
${params.postBody.slice(0, 1200)}

Tagline for brand color: ${brand.tagline}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const fallback = params.postBody.split(/[.!?]/)[0]?.trim() ?? brand.tagline;
    return fallback.slice(0, params.durationSec === 5 ? 120 : 500);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const script = data.choices?.[0]?.message?.content?.trim();
  if (!script) {
    return params.postBody.slice(0, params.durationSec === 5 ? 120 : 500);
  }
  return script.replace(/^["']|["']$/g, "").trim();
}

export async function generateSpeechMp3(script: string, apiKey: string): Promise<Buffer> {
  const voice = process.env.MARKETING_TTS_VOICE?.trim() || "nova";
  const model = process.env.MARKETING_TTS_MODEL?.trim() || "tts-1-hd";

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: script.slice(0, 4096),
      voice,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voice generation failed: ${err.slice(0, 200)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
