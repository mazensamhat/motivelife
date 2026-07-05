import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { disconnectAppleCalDAV } from "@/lib/apple-caldav";

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  await disconnectAppleCalDAV(session.id);
  return json({ ok: true });
}
