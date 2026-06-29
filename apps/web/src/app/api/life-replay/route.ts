import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { buildLifeReplay } from "@/lib/life-replay";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const replay = await buildLifeReplay(session.id);
  return json({ replay });
}
