/**

 * Launch stack cost control — OpenAI is optional and capped.

 *

 * - No OPENAI_API_KEY → rule-based copy only ($0)

 * - ENABLE_OPENAI=false → force off even if key is set

 * - Cached (cheap): daily briefing, evening review, weekly letter — 1 call each per period

 * - Metered: voice AI organize — trial 30 units/mo, Pro 90 units/mo

 *   (quick capture=1, ambient=2, brain dump=3)

 * - Voice practice scoring is always rule-based ($0)

 */

export function isOpenAiEnabled(): boolean {

  if (process.env.ENABLE_OPENAI === "false") return false;

  const key = process.env.OPENAI_API_KEY?.trim();

  return Boolean(key);

}



export function getOpenAiApiKey(): string | null {

  if (!isOpenAiEnabled()) return null;

  return process.env.OPENAI_API_KEY!.trim();

}



/** Cheapest useful model — keep launch bills predictable */

export const OPENAI_MODEL = "gpt-4o-mini";

