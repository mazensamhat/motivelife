import { get } from "@vercel/blob";

type MarketingMediaRow = {
  mediaData: string | null;
  mediaMimeType: string | null;
  mediaUrl: string | null;
  mediaBlobPath?: string | null;
};

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

/** Load stored marketing media bytes (inline DB or Vercel Blob). */
export async function loadMarketingPostMediaBuffer(
  post: MarketingMediaRow
): Promise<Buffer | null> {
  if (post.mediaData) {
    return Buffer.from(post.mediaData, "base64");
  }

  if (post.mediaBlobPath) {
    const result = await get(post.mediaBlobPath, {
      access: "private",
      token: blobToken(),
    });
    if (result?.statusCode === 200 && result.stream) {
      const arrayBuffer = await new Response(result.stream).arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  return null;
}

/** Stream marketing media for admin preview or public social crawlers. */
export async function serveMarketingPostMedia(
  post: MarketingMediaRow | null,
  cache: "public" | "private"
): Promise<Response> {
  if (!post) {
    return new Response("Not found", { status: 404 });
  }

  if (post.mediaData) {
    const buffer = Buffer.from(post.mediaData, "base64");
    const mimeType = post.mediaMimeType ?? "application/octet-stream";
    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control":
          cache === "public"
            ? "public, max-age=31536000, immutable"
            : "private, no-cache",
      },
    });
  }

  if (post.mediaBlobPath) {
    const result = await get(post.mediaBlobPath, {
      access: "private",
      token: blobToken(),
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType ?? post.mediaMimeType ?? "application/octet-stream",
        "Cache-Control":
          cache === "public"
            ? "public, max-age=31536000, immutable"
            : "private, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (post.mediaUrl?.startsWith("http")) {
    return Response.redirect(post.mediaUrl, 302);
  }

  return new Response("Not found", { status: 404 });
}
