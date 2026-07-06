import { z } from "zod";
import { getSession } from "@/lib/session";
import { json, unauthorized, serverError, badRequest } from "@/lib/api";
import { tailorApplicationBriefing } from "@/lib/career-tailor";

const bodySchema = z.object({
  applicationId: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input.");

    const result = await tailorApplicationBriefing(session.id, parsed.data.applicationId);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/career/tailor]", error);
    const message = error instanceof Error ? error.message : "Could not tailor briefing.";
    return badRequest(message);
  }
}
