import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";
import { publishMarketingPostById } from "@/lib/marketing-agent-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const { id } = await params;
    const result = await publishMarketingPostById(id);
    if (!result.ok && result.error === "Post not found") {
      return json({ error: result.error }, 404);
    }
    return json(result);
  } catch (error) {
    console.error("[admin/marketing/publish]", error);
    return serverError("Could not publish post.");
  }
}
