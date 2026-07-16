import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";
import { syncOpsAutoCosts } from "@/lib/ops-cost-sync";

export async function POST() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const result = await syncOpsAutoCosts();
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("[admin/ops-costs/sync]", error);
    return serverError("Could not sync auto ops costs.");
  }
}
