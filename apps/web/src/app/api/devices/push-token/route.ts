import { z } from "zod";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/session";
import { removeDevicePushToken, upsertDevicePushToken } from "@/lib/push";

const schema = z.object({
  token: z.string().min(20).max(512),
  platform: z.enum(["ios", "android"]),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid push token payload.");

    await upsertDevicePushToken({
      userId: session.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
    });

    return json({ ok: true });
  } catch (error) {
    console.error("[api/devices/push-token]", error);
    return serverError("Could not register push token.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return badRequest("Missing token.");

    await removeDevicePushToken(token);
    return json({ ok: true });
  } catch (error) {
    console.error("[api/devices/push-token DELETE]", error);
    return serverError("Could not remove push token.");
  }
}
