import { getBrandProfile } from "@forward/marketing-agent";
import type { MarketingBrandId } from "@forward/marketing-agent";

export async function generateNarrationScript(
  params: {
    brandId: MarketingBrandId;
    postBody: string;
    durationSec: 5 | 30;
  },
  apiKey: string
): Promise<string> {
  const brand = getBrandProfile(params.brandId);
  const wordTarget = params.durationSec === 5 ? "12-18 words" : "65-85 words";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You write short voiceover scripts for ${brand.name} social ads. Voice: ${brand.voice}. Output plain spoken text only — no quotes, hashtags, or stage directions.`,
        },
        {
          role: "user",
          content: `Turn this post into a ${params.durationSec}-second narration (${wordTarget}). Clear CTA, energetic but trustworthy:\n\n${params.postBody.slice(0, 800)}`,
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

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
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
