import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { ingestLocationPing } from "@/lib/family-map/location-engine";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(50_000).optional().nullable(),
  speedKmh: z.number().min(0).max(400).optional().nullable(),
  headingDeg: z.number().min(0).max(360).optional().nullable(),
  batteryPercent: z.number().int().min(0).max(100).optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid location payload.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join or create a Family household first.");

    if (member.locationSharingLevel === "off") {
      return badRequest("Location sharing is off. Enable it in Family privacy settings.");
    }

    await ingestLocationPing({
      memberId: member.id,
      householdId: member.householdId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      accuracyM: parsed.data.accuracyM,
      speedKmh: parsed.data.speedKmh,
      headingDeg: parsed.data.headingDeg,
      batteryPercent: parsed.data.batteryPercent,
      recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : undefined,
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/location]", error);
    return serverError("Could not update location.");
  }
}
