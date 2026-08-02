import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { seedDemoFamily } from "@/lib/family-map/demo-seed";
import { ensureHouseholdForUser } from "@/lib/family-map/household";
import { upsertPlace } from "@/lib/family-map/location-engine";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Share your location to place the demo family nearby.");

    const { household, member } = await ensureHouseholdForUser(session.id, session.name);

    if (household.ownerUserId !== session.id) {
      return badRequest("Only the family owner can seed the demo household.");
    }

    await seedDemoFamily({
      householdId: household.id,
      anchorLat: parsed.data.lat,
      anchorLng: parsed.data.lng,
    });

    await upsertPlace({
      householdId: household.id,
      name: "Home",
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      category: "home",
    });

    const { ingestLocationPing } = await import("@/lib/family-map/location-engine");
    await ingestLocationPing({
      memberId: member.id,
      householdId: household.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      speedKmh: 0,
      batteryPercent: 88,
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/demo POST]", error);
    return serverError("Could not create demo family.");
  }
}

/** Exit the sample household — remove simulated members so only real people remain. */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { household } = await ensureHouseholdForUser(session.id, session.name);
    if (household.ownerUserId !== session.id) {
      return badRequest("Only the family owner can clear the sample household.");
    }

    await prisma.familyMember.deleteMany({
      where: { householdId: household.id, isSimulated: true },
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/demo DELETE]", error);
    return serverError("Could not clear sample household.");
  }
}
