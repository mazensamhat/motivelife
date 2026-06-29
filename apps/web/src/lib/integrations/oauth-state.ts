import { SignJWT, jwtVerify } from "jose";

export type OAuthStatePayload = {
  sub: string;
  returnTo?: string;
  service?: string;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signOAuthState(payload: OAuthStatePayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(authSecret());
}

export async function verifyOAuthState(state: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(state, authSecret());
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;
    return {
      sub,
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : undefined,
      service: typeof payload.service === "string" ? payload.service : undefined,
    };
  } catch {
    return null;
  }
}

export function safeReturnPath(value: string | null | undefined, fallback = "/integrations") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function integrationRedirect(params: Record<string, string>, returnTo?: string) {
  const base = safeReturnPath(returnTo);
  const url = new URL(base, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002");
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }
  return url.pathname + url.search;
}
