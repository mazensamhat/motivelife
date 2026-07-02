import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { forbidden, unauthorized } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  const { id } = await params;
  const post = await prisma.marketingPost.findUnique({
    where: { id },
    select: { narrationData: true, narrationMimeType: true },
  });

  if (!post?.narrationData) {
    return new Response("No narration for this post", { status: 404 });
  }

  const buffer = Buffer.from(post.narrationData, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": post.narrationMimeType ?? "audio/mpeg",
      "Cache-Control": "private, no-cache",
    },
  });
}
