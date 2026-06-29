import { getSession } from "@/lib/session";
import { getProgressStats } from "@/lib/forward";
import { json, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const stats = await getProgressStats(session.id);
  return json({ stats });
}
