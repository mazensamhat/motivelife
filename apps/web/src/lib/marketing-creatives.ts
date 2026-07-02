import { put } from "@vercel/blob";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import sharp from "sharp";
import { getSiteUrl } from "@/lib/site-url";

const MAX_INLINE_BYTES = 3_500_000;

export function marketingMediaPublicUrl(postId: string): string {
  return `${getSiteUrl()}/api/marketing/media/${postId}`;
}

export function marketingMediaAdminPreviewUrl(postId: string, updatedAt: Date | string): string {
  const v = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : updatedAt.getTime();
  return `/api/admin/marketing/posts/${postId}/media?v=${v}`;
}

/** Compress for inline DB storage and faster previews. */
export async function optimizeMediaBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (mimeType.startsWith("image/") && mimeType !== "image/gif") {
    const jpeg = await sharp(buffer).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { buffer: jpeg, mimeType: "image/jpeg" };
  }
  return { buffer, mimeType };
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
}

async function uploadMarketingBlob(
  pathname: string,
  buffer: Buffer,
  mimeType: string,
  token: string
) {
  const attempts = ["private", "public"] as const;
  let lastError: unknown;

  for (const access of attempts) {
    try {
      return await put(pathname, buffer, {
        access,
        contentType: mimeType,
        token,
        allowOverwrite: true,
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      const accessMismatch =
        message.includes("private store") || message.includes("public access");
      if (!accessMismatch) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Blob upload failed.");
}

export async function persistMarketingMedia(
  postId: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ mediaUrl: string; mediaBlobPath: string | null; mediaData: string | null }> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (blobToken) {
    const blob = await uploadMarketingBlob(
      `marketing/${postId}.${extensionForMime(mimeType)}`,
      buffer,
      mimeType,
      blobToken
    );
    return {
      mediaUrl: marketingMediaPublicUrl(postId),
      mediaBlobPath: blob.pathname,
      mediaData: null,
    };
  }

  if (buffer.byteLength > MAX_INLINE_BYTES) {
    throw new Error(
      "Creative file is too large to store inline. Add BLOB_READ_WRITE_TOKEN in Vercel for video/large assets."
    );
  }

  return {
    mediaUrl: marketingMediaPublicUrl(postId),
    mediaBlobPath: null,
    mediaData: buffer.toString("base64"),
  };
}

/** Ken Burns timing/size tuned for channel and clip length (Vercel-safe, no ffmpeg). */
export function kenBurnsOptionsForChannel(
  channel: string | undefined,
  durationSec: number
): { width: number; height: number; frames: number; durationMs: number } {
  const vertical = channel === "instagram" || channel === "tiktok";
  const longClip = durationSec > 5;
  const width = vertical ? (longClip ? 720 : 1080) : longClip ? 1280 : 1920;
  const height = vertical ? (longClip ? 1280 : 1920) : longClip ? 720 : 1080;
  const frames = longClip ? 20 : 16;
  return {
    width,
    height,
    frames,
    durationMs: durationSec * 1000,
  };
}

/** ~5s Ken Burns GIF from a still — no Replicate key required. */
export async function createKenBurnsGif(
  pngBuffer: Buffer,
  opts?: { width?: number; height?: number; frames?: number; durationMs?: number }
): Promise<Buffer> {
  const width = opts?.width ?? 1080;
  const height = opts?.height ?? 1080;
  const frames = opts?.frames ?? 16;
  const durationMs = opts?.durationMs ?? 5000;
  const delay = Math.max(40, Math.round(durationMs / frames));

  const meta = await sharp(pngBuffer).metadata();
  const srcW = meta.width ?? width;
  const srcH = meta.height ?? height;

  const rgbaFrames: Uint8ClampedArray[] = [];

  for (let i = 0; i < frames; i++) {
    const t = frames <= 1 ? 0 : i / (frames - 1);
    const scale = 1 + t * 0.14;
    const cropW = Math.max(1, Math.round(Math.min(srcW, srcW / scale)));
    const cropH = Math.max(1, Math.round(Math.min(srcH, srcH / scale)));
    const left = Math.max(0, Math.round(((srcW - cropW) * t) / 2));
    const top = Math.max(0, Math.round(((srcH - cropH) * t) * 0.35));

    const raw = await sharp(pngBuffer)
      .extract({
        left: Math.min(left, Math.max(0, srcW - cropW)),
        top: Math.min(top, Math.max(0, srcH - cropH)),
        width: Math.min(cropW, srcW),
        height: Math.min(cropH, srcH),
      })
      .resize(width, height, { fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    rgbaFrames.push(new Uint8ClampedArray(raw.data));
  }

  const gif = new GIFEncoder();
  for (const rgba of rgbaFrames) {
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, { palette, delay });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

export async function generateKenBurnsAnimation(pngBase64: string): Promise<{
  mediaType: "gif";
  mimeType: string;
  base64: string;
}> {
  const pngBuffer = Buffer.from(pngBase64, "base64");
  const gifBuffer = await createKenBurnsGif(pngBuffer);
  return {
    mediaType: "gif",
    mimeType: "image/gif",
    base64: gifBuffer.toString("base64"),
  };
}
