import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";
import { deleteMarketingDrafts } from "@/lib/marketing-agent-service";

const BRAND_IDS = new Set(["motivelife", "motivefx", "motiveiq", "motivepulse"]);

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const brandId = new URL(request.url).searchParams.get("brandId")?.trim() || undefined;
    if (brandId && !BRAND_IDS.has(brandId)) {
      return json({ error: "Invalid brandId." }, 400);
    }

    const result = await deleteMarketingDrafts(brandId);
    return json({ ok: true, deleted: result.deleted });
  } catch (error) {
    console.error("[admin/marketing/drafts DELETE]", error);
    return serverError("Could not delete drafts.");
  }
}
