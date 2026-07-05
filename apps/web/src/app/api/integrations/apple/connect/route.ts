import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { saveAppleCalDAVConnection } from "@/lib/apple-caldav";

export const runtime = "nodejs";

const schema = z.object({
  appleId: z.string().email(),
  appPassword: z.string().min(4).max(128),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Enter your Apple ID email and an app-specific password.");
    }

    await saveAppleCalDAVConnection(
      session.id,
      parsed.data.appleId,
      parsed.data.appPassword
    );

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    if (message.includes("401") || message.includes("403") || /auth/i.test(message)) {
      return forbidden(
        "Apple rejected those credentials. Use an app-specific password from appleid.apple.com (not your Apple ID password)."
      );
    }
    console.error("[integrations/apple/connect]", error);
    return serverError(
      "Could not connect Apple Calendar. Check your Apple ID and app-specific password."
    );
  }
}
