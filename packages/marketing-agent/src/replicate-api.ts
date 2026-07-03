/** Replicate prediction helpers (community + official models). */

export async function pollReplicatePrediction(
  id: string,
  token: string,
  timeoutMs: number
): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) throw new Error(`Replicate poll failed (${res.status})`);
    const data = (await res.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
    };
    if (data.status === "succeeded") {
      const out = data.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (!url) throw new Error("Replicate returned empty output.");
      return url;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(data.error ?? "Replicate prediction failed.");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Replicate prediction timed out.");
}

/** Replicate prediction helpers (community + official models). */

function isReplicateThrottleError(message: string): boolean {
  return /throttl|rate limit|429|too many requests/i.test(message);
}

async function createReplicatePredictionOnce(
  model: string,
  input: Record<string, unknown>,
  token: string
): Promise<string> {
  let createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (createRes.status === 404) {
    const modelRes = await fetch(`https://api.replicate.com/v1/models/${model}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!modelRes.ok) {
      const err = await modelRes.text();
      throw new Error(`Replicate model not found (${model}): ${err.slice(0, 200)}`);
    }

    const modelData = (await modelRes.json()) as { latest_version?: { id?: string } };
    const version = modelData.latest_version?.id;
    if (!version) {
      throw new Error(`Replicate model has no version: ${model}`);
    }

    createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version, input }),
    });
  }

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Replicate create failed: ${err.slice(0, 300)}`);
  }

  const created = (await createRes.json()) as { id?: string };
  if (!created.id) throw new Error("Replicate missing prediction id.");
  return created.id;
}

export async function createReplicatePrediction(
  model: string,
  input: Record<string, unknown>,
  token: string
): Promise<string> {
  const maxAttempts = 4;
  let lastError = "Replicate create failed.";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await createReplicatePredictionOnce(model, input, token);
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (!isReplicateThrottleError(lastError) || attempt === maxAttempts) {
        throw error instanceof Error ? error : new Error(lastError);
      }
      const delayMs = attempt * 10_000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw new Error(lastError);
}
