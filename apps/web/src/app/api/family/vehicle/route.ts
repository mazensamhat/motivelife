import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";
import { buildVehicleProfile } from "@/lib/family-map/vehicle-fuel";

const schema = z.object({
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1).nullable().optional(),
  fuelType: z.enum(["gas", "diesel", "hybrid", "ev"]).nullable().optional(),
  litresPer100km: z.number().min(1).max(40).nullable().optional(),
  kwhPer100km: z.number().min(5).max(40).nullable().optional(),
  fuelPriceCadPerLitre: z.number().min(0.5).max(5).nullable().optional(),
  evPriceCadPerKwh: z.number().min(0.01).max(1).nullable().optional(),
});

/** Save the member's vehicle — AI-style economy estimate from make/model. */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Enter make and model for your vehicle.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const profile = buildVehicleProfile({
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      fuelType: parsed.data.fuelType,
      litresPer100km: parsed.data.litresPer100km,
      kwhPer100km: parsed.data.kwhPer100km,
      fuelPriceCadPerLitre: parsed.data.fuelPriceCadPerLitre,
      evPriceCadPerKwh: parsed.data.evPriceCadPerKwh,
    });
    if (!profile) return badRequest("Enter make and model for your vehicle.");

    await prisma.familyMember.update({
      where: { id: member.id },
      data: {
        vehicleMake: profile.make,
        vehicleModel: profile.model,
        vehicleYear: profile.year,
        fuelType: profile.fuelType,
        engineSummary: profile.engineSummary,
        litresPer100km: profile.litresPer100km,
        kwhPer100km: profile.kwhPer100km,
        fuelPriceCadPerLitre: profile.fuelPriceCadPerLitre,
        evPriceCadPerKwh: profile.evPriceCadPerKwh,
      },
    });

    const state = await getFamilyMapState(session.id);
    return json({
      ...state,
      vehicle: profile,
    });
  } catch (error) {
    console.error("[api/family/vehicle PATCH]", error);
    return serverError("Could not save vehicle.");
  }
}
