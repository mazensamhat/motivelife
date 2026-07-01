import { prisma } from "@forward/database";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const post = await prisma.marketingPost.findUnique({
    where: { id },
    select: { mediaData: true, mediaMimeType: true, mediaUrl: true },
  });

  if (!post?.mediaData) {
    if (post?.mediaUrl?.startsWith("http")) {
      return Response.redirect(post.mediaUrl, 302);
    }
    return new Response("Not found", { status: 404 });
  }

  const buffer = Buffer.from(post.mediaData, "base64");
  const mimeType = post.mediaMimeType ?? "application/octet-stream";

  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
