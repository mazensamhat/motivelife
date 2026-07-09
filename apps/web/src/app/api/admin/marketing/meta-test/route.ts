import { getBrandPublisherConfig, testBrandMetaConnection } from "@forward/marketing-agent";
import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin-only: live Meta Graph test per brand (page token + IG link). */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const brands = ["motivelife", "motivefx"] as const;
    const results = await Promise.all(
      brands.map(async (brandId) => {
        const cfg = getBrandPublisherConfig(brandId);
        return testBrandMetaConnection({
          brandId,
          metaAccessToken: cfg.metaAccessToken,
          metaPageId: cfg.metaPageId,
          instagramAccountId: cfg.instagramAccountId,
          fallbackToken: process.env.MARKETING_META_ACCESS_TOKEN?.trim(),
        });
      })
    );

    return json({
      businessId: process.env.MARKETING_META_BUSINESS_ID?.trim() || null,
      results,
    });
  } catch (error) {
    console.error("[admin/marketing/meta-test]", error);
    return serverError("Meta connection test failed.");
  }
}
