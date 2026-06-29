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
  const data = await readApiJson<{ error?: string }>(res);
  if (data?.error) return data.error;
  if (res.status === 401) return "Please sign in again.";
  if (res.status >= 500) return "Server error. Try restarting the app.";
  return "Something went wrong.";
}
