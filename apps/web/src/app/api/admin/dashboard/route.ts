import { getAdminDashboardSnapshot } from "@/lib/admin-analytics";
import { getTrafficAnalytics } from "@/lib/traffic-analytics";
import { requireAdmin } from "@/lib/admin";
import { json, unauthorized, forbidden, serverError } from "@/lib/api";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const [dashboard, traffic] = await Promise.all([
      getAdminDashboardSnapshot(),
      getTrafficAnalytics(30),
    ]);
    return json({ ...dashboard, traffic });
  } catch (error) {
    console.error("[admin/dashboard]", error);
    return serverError("Could not load admin dashboard.");
  }
}
