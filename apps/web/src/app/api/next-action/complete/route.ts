import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { DOMAIN_SLUGS, type DomainSlug } from "@/lib/domain-next-action";
import { completeAndRefresh } from "@/lib/complete-next-action";

const schema = z.object({
  domain: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().min(1).max(300),
  actionHref: z.string().min(1).max(500),
  entityId: z.string().optional(),
  lifeEngine: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const domainRaw = parsed.data.domain ?? parsed.data.slug;
    if (!domainRaw) return badRequest("Invalid domain");

    const domain = domainRaw as DomainSlug;
    if (!(domain in DOMAIN_SLUGS)) return badRequest("Invalid domain");

    const result = await completeAndRefresh(session.id, domain, parsed.data, {
      lifeEngine: parsed.data.lifeEngine,
    });
    return json(result);
  } catch (error) {
    console.error("[api/next-action/complete]", error);
    return serverError("Could not complete action.");
  }
}
