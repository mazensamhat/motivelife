import { probeLinkedInBrand } from "@forward/marketing-agent";
import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin-only: live LinkedIn token/org probe per brand (no raw secrets returned). */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const brands = ["motivelife", "motivefx", "motivepulse"] as const;
    const results = await Promise.all(brands.map((brandId) => probeLinkedInBrand(brandId)));

    return json({
      apiVersionDefault: "202606",
      results,
    });
  } catch (error) {
    console.error("[admin/marketing/linkedin-test]", error);
    return serverError("LinkedIn connection test failed.");
  }
}
