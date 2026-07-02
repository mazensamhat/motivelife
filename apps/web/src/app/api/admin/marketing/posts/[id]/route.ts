import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { deleteMarketingPost } from "@/lib/marketing-agent-service";

type RouteParams = { params: Promise<{ id: string }> };

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
