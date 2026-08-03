import { NextResponse } from "next/server";
import { isAppleSignInConfigured } from "@/lib/auth/apple-signin";
import { getGoogleClientIdPublic, isGoogleSignInConfigured } from "@/lib/auth/google-signin";
import { ensureAuthOAuthSchema } from "@/lib/auth/ensure-oauth-schema";

/** Public flags so the auth UI can hide unconfigured providers. */
export async function GET() {
  try {
    await ensureAuthOAuthSchema();
  } catch (error) {
    console.warn("[auth/oauth-providers] schema ensure failed", error);
  }
  const google = isGoogleSignInConfigured();
  return NextResponse.json({
    google,
    apple: isAppleSignInConfigured(),
    /** Public OAuth Web client id — safe to expose for Google Identity Services. */
    googleClientId: google ? getGoogleClientIdPublic() : null,
  });
}
