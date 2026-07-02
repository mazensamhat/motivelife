import { prisma } from "@forward/database";
import { serveMarketingPostMedia } from "@/lib/marketing-media-serve";

type RouteParams = { params: Promise<{ id: string }> };

/** Public media URL for Meta / Instagram / LinkedIn crawlers. */
export async function GET(_request: Request, { params }: RouteParams) {
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

  return serveMarketingPostMedia(post, "public");
}
