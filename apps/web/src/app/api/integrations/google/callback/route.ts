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

  try {
    const tokens = await exchangeGoogleCode(code);
    await saveGoogleTokens(verified.sub, tokens);
    redirect(integrationRedirect({ connected: "google", provider: "google" }, returnTo));
  } catch {
    redirect(integrationRedirect({ error: "server", provider: "google" }, returnTo));
  }
}
