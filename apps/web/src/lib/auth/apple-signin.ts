/**
 * Sign in with Apple (web Services ID).
 * Requires APPLE_SIGNIN_CLIENT_ID, APPLE_SIGNIN_TEAM_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_PRIVATE_KEY.
 */

import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";

const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export function isAppleSignInConfigured() {
  return Boolean(
    process.env.APPLE_SIGNIN_CLIENT_ID &&
      process.env.APPLE_SIGNIN_TEAM_ID &&
      process.env.APPLE_SIGNIN_KEY_ID &&
      process.env.APPLE_SIGNIN_PRIVATE_KEY,
  );
}

export function getAppleSignInRedirectUri() {
  return (
    process.env.APPLE_SIGNIN_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/api/auth/apple/callback`
  );
}

function normalizeApplePrivateKey(raw: string) {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/** Apple requires a short-lived client secret JWT signed with your .p8 key. */
export async function createAppleClientSecret() {
  const clientId = process.env.APPLE_SIGNIN_CLIENT_ID!;
  const teamId = process.env.APPLE_SIGNIN_TEAM_ID!;
  const keyId = process.env.APPLE_SIGNIN_KEY_ID!;
  const privateKeyPem = normalizeApplePrivateKey(process.env.APPLE_SIGNIN_PRIVATE_KEY!);
  const key = await importPKCS8(privateKeyPem, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("180d")
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(key);
}

export function getAppleSignInAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.APPLE_SIGNIN_CLIENT_ID!,
    redirect_uri: getAppleSignInRedirectUri(),
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state,
  });
  return `${APPLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeAppleCode(code: string) {
  const clientSecret = await createAppleClientSecret();
  const res = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.APPLE_SIGNIN_CLIENT_ID!,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getAppleSignInRedirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[auth/apple] token exchange failed:", res.status, body);
    throw new Error("token_exchange_failed");
  }

  return res.json() as Promise<{
    access_token?: string;
    id_token: string;
    refresh_token?: string;
  }>;
}

export async function verifyAppleIdToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: process.env.APPLE_SIGNIN_CLIENT_ID!,
  });

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) throw new Error("invalid_id_token");

  const email = typeof payload.email === "string" ? payload.email : null;
  const emailVerified =
    payload.email_verified === true ||
    payload.email_verified === "true" ||
    payload.email_verified === undefined;

  return {
    subject: sub,
    email,
    emailVerified,
  };
}

/** Apple only sends the user's name on the first authorization (form body `user`). */
export function parseAppleUserName(userJson: string | null): string | null {
  if (!userJson) return null;
  try {
    const parsed = JSON.parse(userJson) as {
      name?: { firstName?: string; lastName?: string };
    };
    const parts = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  } catch {
    return null;
  }
}
