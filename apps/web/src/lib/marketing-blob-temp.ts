import { put } from "@vercel/blob";
import { signMuxAssetPath } from "@/lib/marketing-mux-token";
import { getSiteUrl } from "@/lib/site-url";

/** Upload a short-lived asset and return a URL external services can fetch (public blob or signed app URL). */
export async function uploadMarketingTempFetchableUrl(
  pathname: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | undefined> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) return undefined;

  const filename = pathname.split("/").pop() || "asset.bin";

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
      // Filename in the path matters — Replicate converters sniff URL extensions (.gif/.mp3/.mp4).
      return `${getSiteUrl()}/api/marketing/mux-input/${encodeURIComponent(filename)}?token=${encodeURIComponent(signed)}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const accessMismatch =
        message.includes("private store") || message.includes("public access");
      if (!accessMismatch) throw error;
    }
  }

  throw new Error("Could not upload temp asset to blob.");
}
