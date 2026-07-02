type ParsedBody = { data: unknown; text: string };

/** Avoid "body stream already read" when callers use readApiJson then readApiError. */
const parsedBodies = new WeakMap<Response, ParsedBody>();

export async function readApiJson<T>(res: Response): Promise<T | null> {
  const { data } = await readApiResponse<T>(res);
  return data;
}

/** Read the response body once — safe to use for both JSON and error text. */
export async function readApiResponse<T>(
  res: Response
): Promise<{ data: T | null; text: string }> {
  const cached = parsedBodies.get(res);
  if (cached) {
    return { data: cached.data as T | null, text: cached.text };
  }

  const text = await res.text();
  if (!text) {
    const empty = { data: null, text: "" };
    parsedBodies.set(res, empty);
    return empty;
  }

  try {
    const parsed = { data: JSON.parse(text) as T, text };
    parsedBodies.set(res, parsed);
    return parsed;
  } catch {
    const fallback = { data: null, text };
    parsedBodies.set(res, fallback);
    return fallback;
  }
}

export function formatApiError(
  res: Response,
  text: string,
  data?: { error?: string } | null
): string {
  if (data?.error) return data.error;
  if (text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (/FUNCTION_INVOCATION_TIMEOUT/i.test(normalized)) {
      return "Server timed out. Uncheck “Generate image or video with drafts”, use fewer channels, or add video per draft with the 5s/30s buttons.";
    }
    const snippet = normalized.slice(0, 200);
    if (snippet) return snippet;
  }
  if (res.status === 401) return "Please sign in again.";
  if (res.status >= 500) return "Server error. Try again in a moment.";
  return "Something went wrong.";
}

export async function readApiError(res: Response): Promise<string> {
  const { data, text } = await readApiResponse<{ error?: string }>(res);
  return formatApiError(res, text, data);
}
