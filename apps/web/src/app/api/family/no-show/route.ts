import { z } from "zod";
import { badRequest, json, premiumRequired, serverError, unauthorized } from "@/lib/api";
import { getViewerFamilyEntitlements } from "@/lib/family-map/require-intelligence";
import {
  deleteNoShowAlert,
  listNoShowAlerts,
  upsertNoShowAlert,
} from "@/lib/family-map/no-show-alerts";

export async function GET() {
  try {
    const { session, entitlements, member } = await getViewerFamilyEntitlements();
    if (!session) return unauthorized();
    if (!member || !entitlements) return badRequest("Join a family first.");
    if (!entitlements.intelligence) {
      return premiumRequired("Upgrade to MyMotiveFamily for No Show Alerts.");
    }
    const alerts = await listNoShowAlerts(member.householdId);
    return json({ alerts });
  } catch (error) {
    console.error("[api/family/no-show GET]", error);
    return serverError("Could not load no-show alerts.");
  }
}

const upsertSchema = z.object({
  memberId: z.string().min(1),
  placeId: z.string().min(1),
  byTimeLocal: z.string().regex(/^\d{1,2}:\d{2}$/),
  enabled: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { session, entitlements, member } = await getViewerFamilyEntitlements();
    if (!session) return unauthorized();
    if (!member || !entitlements) return badRequest("Join a family first.");
    if (!entitlements.intelligence) {
      return premiumRequired("Upgrade to MyMotiveFamily for No Show Alerts.");
    }

    const parsed = upsertSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Invalid no-show alert.");

    const alert = await upsertNoShowAlert({
      householdId: member.householdId,
      memberId: parsed.data.memberId,
      placeId: parsed.data.placeId,
      byTimeLocal: parsed.data.byTimeLocal,
      enabled: parsed.data.enabled,
    });
    return json({ alert });
  } catch (error) {
    console.error("[api/family/no-show POST]", error);
    return serverError("Could not save no-show alert.");
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(request: Request) {
  try {
    const { session, entitlements, member } = await getViewerFamilyEntitlements();
    if (!session) return unauthorized();
    if (!member || !entitlements) return badRequest("Join a family first.");
    if (!entitlements.intelligence) {
      return premiumRequired("Upgrade to MyMotiveFamily for No Show Alerts.");
    }

    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Invalid request.");
    await deleteNoShowAlert({ id: parsed.data.id, householdId: member.householdId });
    return json({ ok: true });
  } catch (error) {
    console.error("[api/family/no-show DELETE]", error);
    return serverError("Could not delete no-show alert.");
  }
}
