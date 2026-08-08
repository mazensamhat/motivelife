import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { createRoadReport } from "@/lib/family-map/road-reports";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";

const createSchema = z.object({
  kind: z.enum(["police", "other"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().max(120).optional().nullable(),
});

/** POST — family member reports police or an event at a map point. */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureFamilyMapSchema();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid road report.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const event = await createRoadReport({
      householdId: member.householdId,
      memberId: member.id,
      memberName: member.displayName,
      kind: parsed.data.kind,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      note: parsed.data.note,
    });

    return json({ ok: true, event });
  } catch (error) {
    console.error("[api/family/road-reports POST]", error);
    return serverError("Could not save road report.");
  }
}
