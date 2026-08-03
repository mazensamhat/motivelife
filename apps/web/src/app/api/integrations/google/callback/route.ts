import { redirect } from "next/navigation";
import { exchangeGoogleCode, saveGoogleTokens } from "@/lib/google-calendar";
import { integrationRedirect, verifyOAuthState } from "@/lib/integrations/oauth-state";
import { authRedirectPath, verifyAuthOAuthState } from "@/lib/auth/oauth-state";
import { exchangeGoogleSignInCode, fetchGoogleUserInfo } from "@/lib/auth/google-signin";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-user";

/**
 * Shared Google OAuth callback (Calendar + Sign-In).
 * Auth states are signed with purpose:"auth"; Calendar states use session sub.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const authState = state ? await verifyAuthOAuthState(state) : null;
  if (authState?.purpose === "auth") {
    const mode = authState.mode;
    if (error || !code) {
      redirect(authRedirectPath(mode, "google_denied"));
    }

    let redirectTo: string;
    try {
      const tokens = await exchangeGoogleSignInCode(code);
      const profile = await fetchGoogleUserInfo(tokens.access_token);
      const result = await findOrCreateOAuthUser(
        {
          provider: "google",
          subject: profile.subject,
          email: profile.email,
          emailVerified: profile.emailVerified,
          name: profile.name,
        },
        authState,
        request,
      );
      redirectTo = result.redirectTo;
    } catch (err) {
      const message = err instanceof Error ? err.message : "google_failed";
      console.error("[api/integrations/google/callback] auth:", err);
      if (message === "oauth_email_required") {
        redirect(authRedirectPath(mode, "google_email_required"));
      }
      if (message === "account_disabled") {
        redirect(authRedirectPath(mode, "account_disabled"));
      }
      if (message === "legal_required") {
        redirect(authRedirectPath("register", "legal_required"));
      }
      redirect(authRedirectPath(mode, "google_failed"));
    }

    redirect(redirectTo);
  }

  const verified = state ? await verifyOAuthState(state) : null;
  const returnTo = verified?.returnTo;

  if (error || !code || !verified) {
    redirect(integrationRedirect({ error: "denied", provider: "google" }, returnTo));
  }

  let tokens;
  try {
    tokens = await exchangeGoogleCode(code);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[api/integrations/google/callback] token exchange:", detail);

    let errorCode = "token_exchange";
    if (detail.includes("redirect_uri_mismatch")) {
      errorCode = "redirect_uri";
    }

    redirect(integrationRedirect({ error: errorCode, provider: "google" }, returnTo));
  }

  try {
    await saveGoogleTokens(verified.sub, tokens);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[api/integrations/google/callback] save tokens:", detail);
    redirect(integrationRedirect({ error: "save_failed", provider: "google" }, returnTo));
  }

  redirect(integrationRedirect({ connected: "google", provider: "google" }, returnTo));
}
