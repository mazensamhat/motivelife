import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { upsertPlace } from "@/lib/family-map/location-engine";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().min(40).max(2000).optional(),
  category: z.enum(["home", "work", "school", "shop", "sports", "other"]).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
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
    console.error("[api/family/places POST]", error);
    return serverError("Could not save place.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid place id.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const place = await prisma.familyPlace.findFirst({
      where: { id: parsed.data.id, householdId: member.householdId },
    });
    if (!place) return badRequest("Place not found.");

    // Clear members currently anchored to this place
    await prisma.familyMember.updateMany({
      where: { householdId: member.householdId, currentPlaceId: place.id },
      data: { currentPlaceId: null },
    });
    await prisma.familyPlace.delete({ where: { id: place.id } });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/places DELETE]", error);
    return serverError("Could not remove place.");
  }
}
