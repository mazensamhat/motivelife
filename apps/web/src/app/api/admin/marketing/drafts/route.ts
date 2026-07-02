import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";
import { deleteMarketingDrafts } from "@/lib/marketing-agent-service";

export async function DELETE() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const result = await deleteMarketingDrafts();
    return json({ ok: true, deleted: result.deleted });
  } catch (error) {
    console.error("[admin/marketing/drafts DELETE]", error);
    return serverError("Could not delete drafts.");
  }
}
