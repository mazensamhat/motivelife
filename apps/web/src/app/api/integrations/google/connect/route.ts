import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getGoogleAuthUrl, isGoogleConfigured } from "@/lib/google-calendar";
import { integrationRedirect, safeReturnPath, signOAuthState } from "@/lib/integrations/oauth-state";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { searchParams } = new URL(request.url);
  const returnTo = safeReturnPath(searchParams.get("returnTo"));

  if (!isGoogleConfigured()) {
    redirect(integrationRedirect({ error: "not_configured", provider: "google" }, returnTo));
  }

  const state = await signOAuthState({ sub: session.id, returnTo });
  redirect(getGoogleAuthUrl(state));
}
