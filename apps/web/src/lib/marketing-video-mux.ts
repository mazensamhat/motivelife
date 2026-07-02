import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { signMuxAssetPath } from "@/lib/marketing-mux-token";
import { getSiteUrl } from "@/lib/site-url";

const MUX_MODEL =
  process.env.MARKETING_MUX_MODEL?.trim() || "lucataco/video-audio-merge";
const TOOLKIT_MODEL = process.env.MARKETING_TOOLKIT_MODEL?.trim() || "fofr/toolkit";
const TOOLKIT_TO_MP4_TASK =
  process.env.MARKETING_TOOLKIT_TO_MP4_TASK?.trim() || "to_mp4";

async function pollReplicatePrediction(
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

async function createReplicatePrediction(
  model: string,
  input: Record<string, unknown>,
  token: string
): Promise<string> {
  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Replicate create failed: ${err.slice(0, 300)}`);
  }

  const created = (await createRes.json()) as { id?: string };
  if (!created.id) throw new Error("Replicate missing prediction id.");
  return created.id;
}

async function uploadMuxTempAsset(
  buffer: Buffer,
  mimeType: string,
  ext: string
): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN required for video mux.");

  const pathname = `marketing/mux-temp/${randomUUID()}.${ext}`;

  // Replicate must fetch these URLs directly — public blob is most reliable.
  for (const access of ["public", "private"] as const) {
    try {
      const blob = await put(pathname, buffer, {
        access,
        contentType: mimeType,
        token: blobToken,
        allowOverwrite: true,
      });
      if (access === "public" && blob.url) return blob.url;
      const signed = signMuxAssetPath(blob.pathname);
      return `${getSiteUrl()}/api/marketing/mux-input?token=${encodeURIComponent(signed)}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const accessMismatch =
        message.includes("private store") || message.includes("public access");
      if (!accessMismatch) throw error;
    }
  }

  throw new Error("Could not upload mux temp asset to blob.");
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download mux output (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

async function gifToMp4(gifUrl: string, token: string, timeoutMs: number): Promise<string> {
  const id = await createReplicatePrediction(
    TOOLKIT_MODEL,
    { input_file: gifUrl, task: TOOLKIT_TO_MP4_TASK },
    token
  );
  return pollReplicatePrediction(id, token, timeoutMs);
}

async function mergeVideoAudio(
  videoUrl: string,
  audioUrl: string,
  durationMode: "video" | "audio",
  token: string,
  timeoutMs: number
): Promise<string> {
  const id = await createReplicatePrediction(
    MUX_MODEL,
    {
      video_file: videoUrl,
      audio_file: audioUrl,
      replace_audio: true,
      duration_mode: durationMode,
      output_format: "mp4",
      video_codec: "h264",
      audio_codec: "aac",
    },
    token
  );
  return pollReplicatePrediction(id, token, timeoutMs);
}

export type MuxResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; noToken?: boolean };

/** Combine visual (MP4 or GIF) with narration MP3 into one MP4 via Replicate. */
export async function muxMarketingVideoWithNarration(
  visualBuffer: Buffer,
  visualMime: string,
  audioMp3: Buffer,
  durationSec: number
): Promise<MuxResult> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "REPLICATE_API_TOKEN not set.", noToken: true };
  }

  const durationMode = durationSec >= 20 ? "audio" : "video";
  const stepTimeoutMs = durationSec >= 20 ? 150_000 : 90_000;
  let lastError = "Unknown mux error.";

  try {
    const visualExt = visualMime === "image/gif" ? "gif" : "mp4";
    const visualUrl = await uploadMuxTempAsset(visualBuffer, visualMime, visualExt);
    const audioUrl = await uploadMuxTempAsset(audioMp3, "audio/mpeg", "mp3");

    let videoUrl = visualUrl;
    if (visualMime === "image/gif") {
      videoUrl = await gifToMp4(visualUrl, token, stepTimeoutMs);
    }

    const mergedUrl = await mergeVideoAudio(
      videoUrl,
      audioUrl,
      durationMode,
      token,
      stepTimeoutMs
    );
    const buffer = await fetchBuffer(mergedUrl);
    return { ok: true, buffer };
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError;
    console.warn("[marketing/mux] Server mux failed", error);
    return { ok: false, error: lastError };
  }
}
