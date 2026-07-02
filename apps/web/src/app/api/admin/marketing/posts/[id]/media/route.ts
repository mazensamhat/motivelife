import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { forbidden, unauthorized } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

/** Admin-authenticated media preview (works with inline DB storage). */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  const { id } = await params;
  const post = await prisma.marketingPost.findUnique({
    where: { id },
    select: { mediaData: true, mediaMimeType: true, mediaUrl: true },
  });

  if (!post?.mediaData) {
    if (post?.mediaUrl?.startsWith("http")) {
      return Response.redirect(post.mediaUrl, 302);
    }
    return new Response("No media for this post", { status: 404 });
  }

  const buffer = Buffer.from(post.mediaData, "base64");
  const mimeType = post.mediaMimeType ?? "application/octet-stream";

  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, no-cache",
    },
  });
}
