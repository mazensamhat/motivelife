import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { databaseErrorMessage } from "@/lib/db-error";
import { updateCircleMemberLocation } from "@/lib/family-map/circles";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  batteryPercent: z.number().int().min(0).max(100).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid location.");

    const activeCircle = await updateCircleMemberLocation({
      userId: session.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      batteryPercent: parsed.data.batteryPercent,
    });

    return json({ activeCircle });
  } catch (error) {
    console.error("[api/circles/location]", error);
    return serverError(databaseErrorMessage(error, "Could not share circle location."));
  }
}
