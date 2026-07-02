export async function readApiJson<T>(res: Response): Promise<T | null> {
  const { data } = await readApiResponse<T>(res);
  return data;
}

/** Read the response body once — safe to use for both JSON and error text. */
export async function readApiResponse<T>(
  res: Response
): Promise<{ data: T | null; text: string }> {
  const text = await res.text();
  if (!text) return { data: null, text: "" };
  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null, text };
  }
}

export function formatApiError(
  res: Response,
  text: string,
  data?: { error?: string } | null
): string {
  if (data?.error) return data.error;
  if (text) {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 200);
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
