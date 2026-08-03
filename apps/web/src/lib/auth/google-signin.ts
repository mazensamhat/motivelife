/**
 * Google Sign-In (openid email profile) — separate redirect from Calendar OAuth.
 * Reuses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET; add the auth callback URI in Google Cloud.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const GOOGLE_SIGNIN_SCOPES = "openid email profile";

export function isGoogleSignInConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleSignInRedirectUri() {
  return (
    process.env.GOOGLE_AUTH_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/api/auth/google/callback`
  );
}

export function getGoogleSignInAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getGoogleSignInRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SIGNIN_SCOPES,
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleSignInCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getGoogleSignInRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[auth/google] token exchange failed:", res.status, body);
    throw new Error("token_exchange_failed");
  }

  return res.json() as Promise<{
    access_token: string;
    id_token?: string;
    expires_in: number;
    scope?: string;
  }>;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error("[auth/google] userinfo failed:", res.status);
    throw new Error("userinfo_failed");
  }
  const data = (await res.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!data.sub || !data.email) throw new Error("oauth_email_required");
  return {
    subject: data.sub,
    email: data.email,
    emailVerified: data.email_verified !== false,
    name: data.name ?? null,
  };
}
