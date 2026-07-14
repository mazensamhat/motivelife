import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import {
  deleteMarketingPost,
  updateMarketingPostPublishOptions,
} from "@/lib/marketing-agent-service";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  publishFormat: z
    .enum(["shorts", "video", "reels", "feed", "story", "short"])
    .optional(),
  publishPrivacy: z.enum(["public", "unlisted", "private"]).nullable().optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid publishFormat or publishPrivacy.");

    const result = await updateMarketingPostPublishOptions(id, parsed.data);
    if (!result.ok) return badRequest(result.error);
    return json({ post: result.post });
  } catch (error) {
    console.error("[admin/marketing/posts PATCH]", error);
    return serverError("Could not update post.");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const { id } = await params;
    const result = await deleteMarketingPost(id);
    if (!result.ok) return badRequest(result.error);
    return json({ ok: true });
  } catch (error) {
    console.error("[admin/marketing/posts DELETE]", error);
    return serverError("Could not delete post.");
  }
}
