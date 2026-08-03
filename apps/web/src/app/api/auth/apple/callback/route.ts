import { NextResponse } from "next/server";
import { authRedirectPath, verifyAuthOAuthState, postAuthRedirect } from "@/lib/auth/oauth-state";
import {
  exchangeAppleCode,
  parseAppleUserName,
  verifyAppleIdToken,
} from "@/lib/auth/apple-signin";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-user";
import { prisma } from "@forward/database";
import { ensureAuthOAuthSchema } from "@/lib/auth/ensure-oauth-schema";
import { createSession } from "@/lib/session";
import { adminRedirectPath } from "@/lib/admin";

function appOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, appOrigin(request)));
}

async function handleAppleCallback(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let code: string | null = null;
  let stateRaw: string | null = null;
  let idToken: string | null = null;
  let userJson: string | null = null;
  let oauthError: string | null = null;

  if (contentType.includes("application/x-www-form-urlencoded") || request.method === "POST") {
    const form = await request.formData();
    code = typeof form.get("code") === "string" ? (form.get("code") as string) : null;
    stateRaw = typeof form.get("state") === "string" ? (form.get("state") as string) : null;
    idToken = typeof form.get("id_token") === "string" ? (form.get("id_token") as string) : null;
    userJson = typeof form.get("user") === "string" ? (form.get("user") as string) : null;
    oauthError = typeof form.get("error") === "string" ? (form.get("error") as string) : null;
  } else {
    const { searchParams } = new URL(request.url);
    code = searchParams.get("code");
    stateRaw = searchParams.get("state");
    idToken = searchParams.get("id_token");
    oauthError = searchParams.get("error");
  }

  const state = stateRaw ? await verifyAuthOAuthState(stateRaw) : null;
  const mode = state?.mode ?? "login";

  if (oauthError) {
    return redirectTo(request, authRedirectPath(mode, "apple_denied"));
  }
  if (!state || state.provider !== "apple") {
    return redirectTo(request, authRedirectPath(mode, "apple_invalid"));
  }

  try {
    let verified = idToken ? await verifyAppleIdToken(idToken) : null;
    if (code) {
      const tokens = await exchangeAppleCode(code);
      verified = await verifyAppleIdToken(tokens.id_token);
    }
    if (!verified) {
      return redirectTo(request, authRedirectPath(mode, "apple_invalid"));
    }

    const email = verified.email;
    if (!email) {
      await ensureAuthOAuthSchema();
      const existing = await prisma.user.findFirst({
        where: { appleSub: verified.subject },
        select: { id: true, email: true, name: true, disabledAt: true },
      });
      if (!existing || existing.disabledAt) {
        return redirectTo(request, authRedirectPath(mode, "apple_email_required"));
      }
      await createSession({ id: existing.id, email: existing.email, name: existing.name });
      return redirectTo(
        request,
        postAuthRedirect(state.plan, adminRedirectPath(existing.email), state.familyInviteCode),
      );
    }

    const name = parseAppleUserName(userJson);
    const { redirectTo: nextPath } = await findOrCreateOAuthUser(
      {
        provider: "apple",
        subject: verified.subject,
        email,
        emailVerified: verified.emailVerified,
        name,
      },
      state,
      request,
    );
    return redirectTo(request, nextPath);
  } catch (error) {
    console.error("[auth/apple/callback]", error);
    const message = error instanceof Error ? error.message : "apple_failed";
    if (message === "legal_required") {
      return redirectTo(request, authRedirectPath("register", "legal_required"));
    }
    if (message === "account_disabled") {
      return redirectTo(request, authRedirectPath(mode, "account_disabled"));
    }
    return redirectTo(request, authRedirectPath(mode, "apple_failed"));
  }
}

export async function POST(request: Request) {
  return handleAppleCallback(request);
}

export async function GET(request: Request) {
  return handleAppleCallback(request);
}
