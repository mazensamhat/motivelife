import { getSession } from "@/lib/session";
import { json, unauthorized, badRequest, serverError } from "@/lib/api";
import { DOMAIN_SLUGS, getDomainNextAction, type DomainSlug } from "@/lib/domain-next-action";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain") as DomainSlug | null;

    if (!domain || !(domain in DOMAIN_SLUGS)) {
      return badRequest("Invalid domain. Use: career, money, health, learning, relationships, memory");
    }

    const action = await getDomainNextAction(session.id, domain);
    return json({ action });
  } catch (error) {
    console.error("[api/next-action]", error);
    return serverError("Could not load next action.");
  }
}
