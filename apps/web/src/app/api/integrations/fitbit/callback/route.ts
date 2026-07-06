import { redirect } from "next/navigation";
import { exchangeFitbitCode, saveFitbitTokens, syncFitbitHealth } from "@/lib/fitbit";
import { integrationRedirect, verifyOAuthState } from "@/lib/integrations/oauth-state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const verified = state ? await verifyOAuthState(state) : null;
  const returnTo = verified?.returnTo;

  if (error || !code || !verified) {
    redirect(integrationRedirect({ error: "denied", provider: "fitbit" }, returnTo));
  }

  try {
    const tokens = await exchangeFitbitCode(code);
    await saveFitbitTokens(verified.sub, tokens);
    try {
      await syncFitbitHealth(verified.sub);
    } catch (syncError) {
      console.warn("[fitbit/callback] initial sync skipped", syncError);
    }
    redirect(integrationRedirect({ connected: "fitbit", provider: "fitbit" }, returnTo));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[api/integrations/fitbit/callback]", detail);
    const errorCode = detail.startsWith("token_exchange:") ? "token_exchange" : "server";
    redirect(integrationRedirect({ error: errorCode, provider: "fitbit" }, returnTo));
  }
}
