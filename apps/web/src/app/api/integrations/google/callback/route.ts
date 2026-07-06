import { redirect } from "next/navigation";
import { exchangeGoogleCode, saveGoogleTokens } from "@/lib/google-calendar";
import { integrationRedirect, verifyOAuthState } from "@/lib/integrations/oauth-state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

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
