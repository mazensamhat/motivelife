export function parseOpenAiUsage(data) {
    if (!data || typeof data !== "object")
        return null;
    const usage = data.usage;
    if (!usage)
        return null;
    const inputTokens = usage.prompt_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? 0;
    if (inputTokens === 0 && outputTokens === 0)
        return null;
    return { inputTokens, outputTokens };
}
