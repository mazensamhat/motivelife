import { requireAdmin } from "@/lib/admin";
import { json, unauthorized, forbidden, serverError } from "@/lib/api";
import { getMarketingAgentMeta, listMarketingPosts } from "@/lib/marketing-agent-service";
import type { MarketingBrandId } from "@forward/marketing-agent";

const BRAND_IDS = new Set<MarketingBrandId>([
  "motivelife",
  "motivefx",
  "motiveiq",
  "motivepulse",
]);

function parseBrandId(raw: string | null): MarketingBrandId | undefined {
  if (!raw?.trim()) return undefined;
  const id = raw.trim() as MarketingBrandId;
  return BRAND_IDS.has(id) ? id : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const raw = new URL(request.url).searchParams.get("brandId");
    if (raw?.trim() && !parseBrandId(raw)) {
      return json({ error: "Invalid brandId." }, 400);
    }
    const brandId = parseBrandId(raw);

    const [posts, meta] = await Promise.all([
      listMarketingPosts(80, brandId),
      getMarketingAgentMeta(),
    ]);
    return json({ posts, brandId: brandId ?? null, ...meta });
  } catch (error) {
    console.error("[admin/marketing]", error);
    return serverError("Could not load marketing posts.");
  }
}
