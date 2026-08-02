import { createSessionToken, getSession } from "@/lib/session";
import { json, serverError, unauthorized } from "@/lib/api";

/**
 * Mint a JWT the native shell can store for background Family location posts.
 * Same claims as the httpOnly forward_session cookie (which JS cannot read).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const token = await createSessionToken(session);
    return json({
      token,
      userId: session.id,
      expiresInSeconds: 60 * 60 * 24 * 30,
    });
  } catch (error) {
    console.error("[api/auth/native-session]", error);
    return serverError("Could not create native session.");
  }
}
