import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { generatePostCreative } from "@/lib/marketing-creative-service";

/** DALL·E + narrated video can take 2–3 minutes on Vercel. */
export const maxDuration = 180;

const schema = z.object({
  kind: z.enum(["image", "video_5", "video_30"]),
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
    if (!parsed.success) return badRequest("kind must be image or animation.");

    const result = await generatePostCreative(id, parsed.data.kind);
    if (!result.ok) return badRequest(result.error);

    return json({ post: result.post, previewUrl: result.previewUrl, fallbackNote: result.fallbackNote });
  } catch (error) {
    console.error("[admin/marketing/posts/creative]", error);
    return serverError("Could not generate creative.");
  }
}
