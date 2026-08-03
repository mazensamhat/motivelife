import { redirect } from "next/navigation";
import {
  authRedirectPath,
  signAuthOAuthState,
  type AuthOAuthStatePayload,
} from "@/lib/auth/oauth-state";
import { getAppleSignInAuthUrl, isAppleSignInConfigured } from "@/lib/auth/apple-signin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "register" ? "register" : "login";

  if (!isAppleSignInConfigured()) {
    redirect(authRedirectPath(mode, "apple_not_configured"));
  }

  if (mode === "register" && searchParams.get("legal") !== "1") {
    redirect(authRedirectPath("register", "legal_required"));
  }

  const payload: Omit<AuthOAuthStatePayload, "purpose"> = {
    provider: "apple",
    mode,
    plan: searchParams.get("plan") ?? undefined,
    partnerInviteCode: searchParams.get("partner") ?? undefined,
    referralCode: searchParams.get("ref") ?? undefined,
    circleTag: searchParams.get("tag") ?? undefined,
    acquisitionChannel: searchParams.get("acq") ?? undefined,
    marketingEmailConsent: searchParams.get("mkt") === "1",
    legalAccepted: mode === "register" ? true : undefined,
  };

  const state = await signAuthOAuthState(payload);
  redirect(getAppleSignInAuthUrl(state));
}
