import { NextResponse } from "next/server";
import { isAppleSignInConfigured } from "@/lib/auth/apple-signin";
import { isGoogleSignInConfigured } from "@/lib/auth/google-signin";
import { ensureAuthOAuthSchema } from "@/lib/auth/ensure-oauth-schema";

/** Public flags so the auth UI can hide unconfigured providers. */
export async function GET() {
  try {
    await ensureAuthOAuthSchema();
  } catch (error) {
    console.warn("[auth/oauth-providers] schema ensure failed", error);
  }
  return NextResponse.json({
    google: isGoogleSignInConfigured(),
    apple: isAppleSignInConfigured(),
  });
}
