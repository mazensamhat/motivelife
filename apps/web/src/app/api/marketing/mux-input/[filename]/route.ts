import { get } from "@vercel/blob";
import { verifyMuxAssetToken } from "@/lib/marketing-mux-token";

export const runtime = "nodejs";

/** Serve a signed private-blob asset; `filename` is for Replicate extension sniffing only. */
export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  let pathname: string;
  try {
    const verified = verifyMuxAssetToken(token);
    if (!verified) return new Response("Invalid or expired token", { status: 403 });
    pathname = verified.pathname;
  } catch {
    return new Response("Mux unavailable", { status: 503 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    return new Response("Blob not configured", { status: 503 });
  }

  const result = await get(pathname, { access: "private", token: blobToken });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return new Response("Not found", { status: 404 });
  }

  const safeName = filename.replace(/[^\w.\-]+/g, "_") || "asset.bin";
  const contentType =
    result.blob.contentType ??
    (safeName.endsWith(".gif")
      ? "image/gif"
      : safeName.endsWith(".mp3")
        ? "audio/mpeg"
        : safeName.endsWith(".mp4")
          ? "video/mp4"
          : "application/octet-stream");

  return new Response(result.stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
