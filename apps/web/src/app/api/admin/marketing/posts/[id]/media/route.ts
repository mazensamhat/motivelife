import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { forbidden, unauthorized } from "@/lib/api";
import { serveMarketingPostMedia } from "@/lib/marketing-media-serve";

type RouteParams = { params: Promise<{ id: string }> };

/** Admin-authenticated media preview (inline DB or private Vercel Blob). */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  const { id } = await params;
  const post = await prisma.marketingPost.findUnique({
    where: { id },
    select: {
      mediaData: true,
      mediaMimeType: true,
      mediaUrl: true,
      mediaBlobPath: true,
    },
  });

  if (!post?.mediaData && !post?.mediaBlobPath && !post?.mediaUrl?.startsWith("http")) {
    return new Response("No media for this post", { status: 404 });
  }

  return serveMarketingPostMedia(post, "private");
}
