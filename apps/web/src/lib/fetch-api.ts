export async function readApiJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (text) {
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data?.error) return data.error;
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 200);
      if (snippet) return snippet;
    }
  }
  if (res.status === 401) return "Please sign in again.";
  if (res.status >= 500) return "Server error. Try again in a moment.";
  return "Something went wrong.";
}
