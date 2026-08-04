import { z } from "zod";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { verifyAppleIdToken } from "@/lib/auth/apple-signin";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-user";
import type { AuthOAuthStatePayload } from "@/lib/auth/oauth-state";

const schema = z.object({
  identityToken: z.string().min(20),
  email: z.string().email().optional().nullable(),
  fullName: z.string().max(120).optional().nullable(),
  mode: z.enum(["login", "register"]).default("login"),
  plan: z.string().max(32).optional(),
  partnerInviteCode: z.string().min(6).max(20).optional(),
  familyInviteCode: z.string().min(4).max(12).optional(),
  referralCode: z.string().min(6).max(20).optional(),
  circleTag: z.string().max(16).optional(),
  acquisitionChannel: z.string().max(64).optional(),
  marketingEmailConsent: z.boolean().optional(),
  legalAccepted: z.boolean().optional(),
});

/**
 * Native iOS Sign in with Apple (expo-apple-authentication).
 * Identity token audience is the App ID (com.mymotivelife.app), not the web Services ID.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid Apple sign-in payload.");

    const data = parsed.data;
    if (data.mode === "register" && !data.legalAccepted) {
      return badRequest("Please accept all required agreements before continuing with Apple.");
    }

    const profile = await verifyAppleIdToken(data.identityToken);
    const email = profile.email ?? data.email ?? null;

    const state: AuthOAuthStatePayload = {
      purpose: "auth",
      provider: "apple",
      mode: data.mode,
      plan: data.plan,
      partnerInviteCode: data.partnerInviteCode,
      familyInviteCode: data.familyInviteCode,
      referralCode: data.referralCode,
      circleTag: data.circleTag,
      acquisitionChannel: data.acquisitionChannel,
      marketingEmailConsent: data.marketingEmailConsent,
      legalAccepted: data.legalAccepted,
    };

    const { redirectTo } = await findOrCreateOAuthUser(
      {
        provider: "apple",
        subject: profile.subject,
        email,
        emailVerified: profile.emailVerified,
        name: data.fullName ?? null,
      },
      state,
      request,
    );

    return json({ redirectTo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "apple_failed";
    console.error("[auth/apple/id-token]", error);
    if (message === "oauth_email_required") {
      return badRequest(
        "Apple didn’t share an email for a new account. Use email signup, or try again with Share My Email.",
      );
    }
    if (message === "account_disabled") {
      return unauthorized("This account has been disabled. Contact support.");
    }
    if (message === "legal_required") {
      return badRequest("Please accept all required agreements before continuing with Apple.");
    }
    if (message === "oauth_conflict") {
      return badRequest("This email is already linked to a different Apple account.");
    }
    if (
      message === "invalid_id_token" ||
      /audience|jwt|claim|signature/i.test(message)
    ) {
      return badRequest(
        "Could not verify Apple account. Update MotiveLife from the install link and try again.",
      );
    }
    return serverError("Could not complete Apple sign-in.");
  }
}
