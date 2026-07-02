import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { createReplicatePrediction, pollReplicatePrediction } from "@forward/marketing-agent";
import { signMuxAssetPath } from "@/lib/marketing-mux-token";
import { getSiteUrl } from "@/lib/site-url";

const MUX_MODEL =
  process.env.MARKETING_MUX_MODEL?.trim() || "lucataco/video-audio-merge";
const TOOLKIT_MODEL = process.env.MARKETING_TOOLKIT_MODEL?.trim() || "fofr/toolkit";
const TOOLKIT_TO_MP4_TASK =
  process.env.MARKETING_TOOLKIT_TO_MP4_TASK?.trim() || "gif_to_mp4";

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
    { video: gifUrl, task: TOOLKIT_TO_MP4_TASK },
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
      try {
        videoUrl = await gifToMp4(visualUrl, token, stepTimeoutMs);
      } catch (error) {
        const message = error instanceof Error ? error.message : "GIF to MP4 failed.";
        throw new Error(`GIF→MP4 (${TOOLKIT_MODEL}): ${message}`);
      }
    }

    try {
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
      const message = error instanceof Error ? error.message : "Audio merge failed.";
      throw new Error(`Mux (${MUX_MODEL}): ${message}`);
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError;
    console.warn("[marketing/mux] Server mux failed", error);
    return { ok: false, error: lastError };
  }
}
