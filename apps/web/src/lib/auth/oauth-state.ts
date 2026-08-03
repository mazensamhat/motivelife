import { SignJWT, jwtVerify } from "jose";

export type AuthOAuthProvider = "google" | "apple";

export type AuthOAuthStatePayload = {
  /** Always "auth" so we don't collide with integration OAuth states. */
  purpose: "auth";
  provider: AuthOAuthProvider;
  mode: "login" | "register";
  plan?: string;
  partnerInviteCode?: string;
  referralCode?: string;
  circleTag?: string;
  acquisitionChannel?: string;
  marketingEmailConsent?: boolean;
  /** Register flows must have accepted required legal consents before redirect. */
  legalAccepted?: boolean;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signAuthOAuthState(payload: Omit<AuthOAuthStatePayload, "purpose">) {
  return new SignJWT({ ...payload, purpose: "auth" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(authSecret());
}

export async function verifyAuthOAuthState(state: string): Promise<AuthOAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(state, authSecret());
    if (payload.purpose !== "auth") return null;
    const provider = payload.provider;
    const mode = payload.mode;
    if (provider !== "google" && provider !== "apple") return null;
    if (mode !== "login" && mode !== "register") return null;
    return {
      purpose: "auth",
      provider,
      mode,
      plan: typeof payload.plan === "string" ? payload.plan : undefined,
      partnerInviteCode:
        typeof payload.partnerInviteCode === "string" ? payload.partnerInviteCode : undefined,
      referralCode: typeof payload.referralCode === "string" ? payload.referralCode : undefined,
      circleTag: typeof payload.circleTag === "string" ? payload.circleTag : undefined,
      acquisitionChannel:
        typeof payload.acquisitionChannel === "string" ? payload.acquisitionChannel : undefined,
      marketingEmailConsent:
        typeof payload.marketingEmailConsent === "boolean"
          ? payload.marketingEmailConsent
          : undefined,
      legalAccepted: typeof payload.legalAccepted === "boolean" ? payload.legalAccepted : undefined,
    };
  } catch {
    return null;
  }
}

export function authRedirectPath(mode: "login" | "register", error?: string) {
  const path = mode === "register" ? "/register" : "/login";
  if (!error) return path;
  return `${path}?oauth_error=${encodeURIComponent(error)}`;
}

export function postAuthRedirect(plan?: string, adminPath?: string) {
  if (adminPath) return adminPath;
  if (plan === "family") return "/family-map";
  return "/dashboard";
}
