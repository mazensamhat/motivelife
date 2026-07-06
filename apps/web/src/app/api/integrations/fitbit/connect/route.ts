import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getFitbitAuthUrl, isFitbitConfigured } from "@/lib/fitbit";
import { integrationRedirect, safeReturnPath, signOAuthState } from "@/lib/integrations/oauth-state";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { searchParams } = new URL(request.url);
  const returnTo = safeReturnPath(searchParams.get("returnTo"));

  if (!isFitbitConfigured()) {
    redirect(integrationRedirect({ error: "not_configured", provider: "fitbit" }, returnTo));
  }

  const state = await signOAuthState({ sub: session.id, returnTo, service: "fitbit" });
  redirect(getFitbitAuthUrl(state));
}
