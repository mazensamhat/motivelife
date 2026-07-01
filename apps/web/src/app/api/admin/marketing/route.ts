import { requireAdmin } from "@/lib/admin";
import { json, unauthorized, forbidden, serverError } from "@/lib/api";
import { getMarketingAgentMeta, listMarketingPosts } from "@/lib/marketing-agent-service";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const [posts, meta] = await Promise.all([listMarketingPosts(), getMarketingAgentMeta()]);
    return json({ posts, ...meta });
  } catch (error) {
    console.error("[admin/marketing]", error);
    return serverError("Could not load marketing posts.");
  }
}
