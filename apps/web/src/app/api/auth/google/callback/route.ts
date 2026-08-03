import { redirect } from "next/navigation";
import { authRedirectPath, verifyAuthOAuthState } from "@/lib/auth/oauth-state";
import { exchangeGoogleSignInCode, fetchGoogleUserInfo } from "@/lib/auth/google-signin";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-user";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const state = stateRaw ? await verifyAuthOAuthState(stateRaw) : null;
  const mode = state?.mode ?? "login";

  if (oauthError) {
    redirect(authRedirectPath(mode, "google_denied"));
  }
  if (!code || !state || state.provider !== "google") {
    redirect(authRedirectPath(mode, "google_invalid"));
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
      state,
      request,
    );
    redirectTo = result.redirectTo;
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_failed";
    console.error("[auth/google/callback]", error);
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
