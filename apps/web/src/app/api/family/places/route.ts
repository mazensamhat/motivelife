import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { upsertPlace } from "@/lib/family-map/location-engine";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const schema = z.object({
  name: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().min(40).max(2000).optional(),
  category: z.enum(["home", "work", "school", "shop", "sports", "other"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid place.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    await upsertPlace({
      householdId: member.householdId,
      name: parsed.data.name,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusM: parsed.data.radiusM,
      category: parsed.data.category,
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/places]", error);
    return serverError("Could not save place.");
  }
}
