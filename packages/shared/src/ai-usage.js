/** OpenAI usage caps — tuned for MotiveLife Pro ($14.99/mo) on gpt-4o-mini */
/** Pro subscribers: AI voice organizes per calendar month */
export const PLUS_VOICE_ORGANIZE_CAP = 90;
/** Trial: lower cap for the trial period (per month) */
export const TRIAL_VOICE_ORGANIZE_CAP = 30;
/** gpt-4o-mini list pricing (USD per 1M tokens) */
export const OPENAI_MINI_INPUT_PER_M = 0.15;
export const OPENAI_MINI_OUTPUT_PER_M = 0.6;
export function voiceOrganizeWeight(source) {
    switch (source) {
        case "brain_dump":
            return 3;
        case "ambient_capture":
            return 2;
        default:
            return 1;
    }
}
export function estimateOpenAiCostUsd(inputTokens, outputTokens) {
    return ((inputTokens / 1_000_000) * OPENAI_MINI_INPUT_PER_M +
        (outputTokens / 1_000_000) * OPENAI_MINI_OUTPUT_PER_M);
}
