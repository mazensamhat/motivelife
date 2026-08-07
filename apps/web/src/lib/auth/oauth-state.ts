import { SignJWT, jwtVerify } from "jose";

export type AuthOAuthProvider = "google" | "apple";

export type AuthOAuthStatePayload = {
  /** Always "auth" so we don't collide with integration OAuth states. */
  purpose: "auth";
  provider: AuthOAuthProvider;
  mode: "login" | "register";
  plan?: string;
  partnerInviteCode?: string;
  /** Family household invite code — after auth, join via /family/join/[code]. */
  familyInviteCode?: string;
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
      familyInviteCode:
        typeof payload.familyInviteCode === "string" ? payload.familyInviteCode : undefined,
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

export function authRedirectPath(
  mode: "login" | "register",
  error?: string,
  familyInviteCode?: string
) {
  const path = mode === "register" ? "/register" : "/login";
  const params = new URLSearchParams();
  if (error) params.set("oauth_error", error);
  if (familyInviteCode) params.set("family", familyInviteCode);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function postAuthRedirect(
  plan?: string,
  adminPath?: string,
  familyInviteCode?: string
) {
  const code = familyInviteCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (code) return `/family/join/${encodeURIComponent(code)}`;
  if (plan === "family") return "/family-map";
  // Prefer Mode of Life home. Only honor an explicit /admin when callers pass it
  // (adminRedirectPath now returns /dashboard by default).
  if (adminPath === "/admin") return "/admin";
  if (adminPath === "/dashboard") return "/dashboard";
  return adminPath || "/dashboard";
}
