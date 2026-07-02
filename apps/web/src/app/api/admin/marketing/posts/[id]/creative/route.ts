import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { generatePostCreative } from "@/lib/marketing-creative-service";

/** DALL·E + narrated 30s video (2× Replicate) can take up to 5 minutes on Vercel. */
export const maxDuration = 300;

const schema = z.object({
  kind: z.enum(["image", "animation", "video_5", "video_30"]),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("kind must be image, animation, video_5, or video_30.");

    const result = await generatePostCreative(id, parsed.data.kind);
    if (!result.ok) return badRequest(result.error);

    return json({ post: result.post, previewUrl: result.previewUrl, fallbackNote: result.fallbackNote });
  } catch (error) {
    console.error("[admin/marketing/posts/creative]", error);
    return serverError("Could not generate creative.");
  }
}
