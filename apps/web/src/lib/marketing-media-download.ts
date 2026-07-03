type DownloadablePost = {
  id: string;
  channel: string | null;
  mediaType: string | null;
  mediaPreviewUrl: string | null;
  narrationPreviewUrl?: string | null;
};

function extensionFor(mediaType: string | null, mimeHint?: string): string {
  if (mediaType === "video") return "mp4";
  if (mediaType === "gif") return "gif";
  if (mimeHint?.includes("jpeg")) return "jpg";
  if (mimeHint?.includes("webp")) return "webp";
  return "png";
}

async function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadPostMedia(post: DownloadablePost): Promise<void> {
  if (!post.mediaPreviewUrl) {
    throw new Error("No media to download.");
  }

  const res = await fetch(post.mediaPreviewUrl);
  if (!res.ok) throw new Error("Could not download media.");

  const blob = await res.blob();
  const ext = extensionFor(post.mediaType, blob.type);
  const channel = post.channel ?? "creative";
  await triggerBlobDownload(blob, `motivelife-${channel}-${post.id.slice(0, 8)}.${ext}`);
}

export async function downloadPostNarration(post: DownloadablePost): Promise<void> {
  if (!post.narrationPreviewUrl) {
    throw new Error("No voiceover to download.");
  }

  const res = await fetch(post.narrationPreviewUrl);
  if (!res.ok) throw new Error("Could not download voiceover.");

  const blob = await res.blob();
  const channel = post.channel ?? "voiceover";
  await triggerBlobDownload(blob, `motivelife-${channel}-${post.id.slice(0, 8)}-voice.mp3`);
}
