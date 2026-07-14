import { getBrandProfile } from "@forward/marketing-agent";
import type { MarketingBrandId } from "@forward/marketing-agent";

function wordBudget(durationSec: 5 | 15 | 30): string {
  if (durationSec === 5) return "12-18 words";
  if (durationSec === 15) return "35-45 words";
  return "70-95 words";
}

function structureHint(durationSec: 5 | 15 | 30): string {
  if (durationSec === 5) {
    return `Structure for 5s (very tight):
1) Hook in the first breath (concrete pain or contrast)
2) One named product moment (real feature, not "AI magic")
3) Soft CTA — one short phrase`;
  }
  if (durationSec === 15) {
    return `Structure for 15s (product story):
1) Hook (1–2s of speech) — specific contrast
2) Feature beat — one concrete UI moment and why it matters
3) Proof or outcome in plain language
4) Soft CTA tied to the offer`;
  }
  return `Structure for 30s (cinematic but spoken):
1) Hook — concrete pain or aspiration
2) Feature story — walk through one real workflow beat
3) Outcome — what the viewer gets next week
4) Soft CTA with the offer, no hard sell`;
}

export async function generateNarrationScript(
  params: {
    brandId: MarketingBrandId;
    postBody: string;
    durationSec: 5 | 15 | 30;
    brief?: string | null;
  },
  apiKey: string
): Promise<string> {
  const brand = getBrandProfile(params.brandId);
  const wordTarget = wordBudget(params.durationSec);
  const model = process.env.MARKETING_NARRATION_MODEL?.trim() || "gpt-4o";
  const maxFallback = params.durationSec === 5 ? 120 : params.durationSec === 15 ? 320 : 500;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content: `You write premium voiceover scripts for ${brand.name} Reels / short ads.

Voice: ${brand.voice}
Audience: ${brand.audience}
Offer: ${brand.trialOffer ?? brand.siteUrl}
Tagline: ${brand.tagline}

Output plain spoken text only — no quotes, hashtags, emoji, stage directions, or [brackets].

${structureHint(params.durationSec)}

Sound like a confident human, not an ad robot. Hit ~${wordTarget} total.`,
        },
        {
          role: "user",
          content: `Write a ${params.durationSec}-second narration (${wordTarget}).

Brief: ${params.brief?.trim() || "(use post)"}
Post copy:
${params.postBody.slice(0, 1200)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const fallback = params.postBody.split(/[.!?]/)[0]?.trim() ?? brand.tagline;
    return fallback.slice(0, maxFallback);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const script = data.choices?.[0]?.message?.content?.trim();
  if (!script) {
    return params.postBody.slice(0, maxFallback);
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
