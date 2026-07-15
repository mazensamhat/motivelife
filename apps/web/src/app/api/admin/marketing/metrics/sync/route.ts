import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";
import { syncMarketingPostMetrics } from "@/lib/marketing-metrics-sync";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const body = (await request.json().catch(() => ({}))) as { postIds?: string[] };
    const result = await syncMarketingPostMetrics(
      Array.isArray(body.postIds) ? body.postIds.filter(Boolean).slice(0, 40) : undefined
    );
    return json(result);
  } catch (error) {
    console.error("[admin/marketing/metrics/sync]", error);
    return serverError("Could not sync marketing metrics.");
  }
}
