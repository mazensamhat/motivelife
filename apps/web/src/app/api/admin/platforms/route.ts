import { requireAdmin } from "@/lib/admin";
import { json, serverError, unauthorized, forbidden } from "@/lib/api";
import { getPlatformMonitorSnapshot } from "@/lib/platform-monitor";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  try {
    const snapshot = await getPlatformMonitorSnapshot();
    return json(snapshot);
  } catch (error) {
    console.error("[admin/platforms]", error);
    return serverError("Could not load platform monitor.");
  }
}
