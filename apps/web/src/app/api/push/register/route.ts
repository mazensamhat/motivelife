import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { removePushDeviceToken, upsertPushDeviceToken } from "@/lib/push";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";

const registerSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().max(40).optional().nullable(),
});

const unregisterSchema = z.object({
  token: z.string().min(8).max(512),
});

/** Register Expo push token for Life360-style Family alerts. */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureFamilyMapSchema();
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return badRequest("Valid push token required.");

    const row = await upsertPushDeviceToken({
      userId: session.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
      appVersion: parsed.data.appVersion,
    });

    return json({ ok: true, id: row?.id ?? null });
  } catch (error) {
    console.error("[api/push/register]", error);
    return serverError("Could not register push token.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const parsed = unregisterSchema.safeParse(body);
    if (!parsed.success) return badRequest("Token required.");

    await removePushDeviceToken(session.id, parsed.data.token);
    return json({ ok: true });
  } catch (error) {
    console.error("[api/push/unregister]", error);
    return serverError("Could not unregister push token.");
  }
}
