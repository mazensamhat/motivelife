import { NextResponse } from "next/server";
import { createSessionToken, getSessionFromRequest } from "@/lib/session";

const SESSION_COOKIE = "forward_session";
const SESSION_DURATION = 60 * 60 * 24 * 30; // 30 days

/**
 * Restore the httpOnly forward_session cookie from a native-stored JWT.
 * Used by the iOS Expo shell on cold start — WKWebView often drops cookies
 * when the app is killed even when Max-Age was set.
 *
 * Accepts Authorization: Bearer <jwt> or X-MotiveLife-Session: <jwt>
 * (passed as the initial WebView request header).
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  if (!session) {
    return NextResponse.redirect(new URL(next ?? "/login", url.origin));
  }

  const token = await createSessionToken(session);
  const res = NextResponse.redirect(new URL(next ?? "/dashboard", url.origin));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    expires: new Date(Date.now() + SESSION_DURATION * 1000),
    path: "/",
  });
  return res;
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const token = await createSessionToken(session);
  const res = NextResponse.json({ ok: true, userId: session.id });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    expires: new Date(Date.now() + SESSION_DURATION * 1000),
    path: "/",
  });
  return res;
}

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
