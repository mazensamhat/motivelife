import { get } from "@vercel/blob";
import { verifyMuxAssetToken } from "@/lib/marketing-mux-token";

export const runtime = "nodejs";

/** Short-lived signed URLs for Replicate to fetch mux inputs from private blob. */
export async function GET(request: Request) {
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

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
