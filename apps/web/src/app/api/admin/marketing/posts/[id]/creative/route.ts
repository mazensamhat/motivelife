import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { generatePostCreative } from "@/lib/marketing-creative-service";

const schema = z.object({
  kind: z.enum(["image", "animation"]),
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

    return json({ post: result.post });
  } catch (error) {
    console.error("[admin/marketing/posts/creative]", error);
    return serverError("Could not generate creative.");
  }
}
