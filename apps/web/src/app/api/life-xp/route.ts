import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { getLifeXpGrowthPayload, getLifeXpPayload } from "@/lib/life-xp";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  if (searchParams.get("growth") === "true") {
    return json(await getLifeXpGrowthPayload(session.id));
  }

  return json(await getLifeXpPayload(session.id));
}
