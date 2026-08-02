import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { buildFamilyAreaIntel } from "@/lib/family-map/area-intel";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Optional weather enrichment — never on the critical map path. */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const url = new URL(request.url);
    const parsed = schema.safeParse({
      lat: url.searchParams.get("lat"),
      lng: url.searchParams.get("lng"),
    });
    if (!parsed.success) return badRequest("lat/lng required.");

    const areaIntel = await buildFamilyAreaIntel({
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      members: [],
    });

    return json({ areaIntel });
  } catch (error) {
    console.error("[api/family/area-intel]", error);
    return serverError("Could not load area conditions.");
  }
}
