import type { GeneratedMedia } from "./creatives";

export type GeminiBrowserGenerateParams = {
  prompt: string;
  referenceBase64?: string;
  referenceMimeType?: string;
};

function workerHeaders(secret?: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret?.trim()) headers["Authorization"] = `Bearer ${secret.trim()}`;
  return headers;
}

export async function pingGeminiBrowserWorker(
  baseUrl: string,
  secret?: string
): Promise<{ ok: boolean; loggedIn?: boolean; detail?: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  try {
    const res = await fetch(url, {
      headers: workerHeaders(secret),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { ok?: boolean; loggedIn?: boolean; detail?: string };
    return {
      ok: Boolean(data.ok),
      loggedIn: data.loggedIn,
      detail: data.detail,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Worker unreachable",
    };
  }
}

export async function generateMarketingImageViaGeminiBrowser(
  workerUrl: string,
  params: GeminiBrowserGenerateParams,
  secret?: string
): Promise<GeneratedMedia> {
  const url = `${workerUrl.replace(/\/$/, "")}/generate`;
  const res = await fetch(url, {
    method: "POST",
    headers: workerHeaders(secret),
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(240_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini browser worker failed: ${err.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    base64?: string;
    mimeType?: string;
    prompt?: string;
  };

  if (!data.base64) {
    throw new Error("Gemini browser worker returned no image.");
  }

  return {
    mediaType: "image",
    mimeType: data.mimeType ?? "image/png",
    base64: data.base64,
    prompt: data.prompt ?? params.prompt,
    source: "gemini",
  };
}
