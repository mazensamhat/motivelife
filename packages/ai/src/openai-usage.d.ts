export interface OpenAiUsage {
    inputTokens: number;
    outputTokens: number;
}
export declare function parseOpenAiUsage(data: unknown): OpenAiUsage | null;
