import { z } from "zod";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { verifyGoogleIdToken } from "@/lib/auth/google-signin";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-user";
import type { AuthOAuthStatePayload } from "@/lib/auth/oauth-state";

const schema = z.object({
  credential: z.string().min(20),
  mode: z.enum(["login", "register"]).default("login"),
  plan: z.string().max(32).optional(),
  partnerInviteCode: z.string().min(6).max(20).optional(),
  referralCode: z.string().min(6).max(20).optional(),
  circleTag: z.string().max(16).optional(),
  acquisitionChannel: z.string().max(64).optional(),
  marketingEmailConsent: z.boolean().optional(),
  legalAccepted: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid Google sign-in payload.");

    const data = parsed.data;
    if (data.mode === "register" && !data.legalAccepted) {
      return badRequest("Please accept all required agreements before continuing with Google.");
    }

    const profile = await verifyGoogleIdToken(data.credential);
    const state: AuthOAuthStatePayload = {
      purpose: "auth",
      provider: "google",
      mode: data.mode,
      plan: data.plan,
      partnerInviteCode: data.partnerInviteCode,
      referralCode: data.referralCode,
      circleTag: data.circleTag,
      acquisitionChannel: data.acquisitionChannel,
      marketingEmailConsent: data.marketingEmailConsent,
      legalAccepted: data.legalAccepted,
    };

    const { redirectTo } = await findOrCreateOAuthUser(
      {
        provider: "google",
        subject: profile.subject,
        email: profile.email,
        emailVerified: profile.emailVerified,
        name: profile.name,
      },
      state,
      request,
    );

    return json({ redirectTo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_failed";
    console.error("[auth/google/id-token]", error);
    if (message === "oauth_email_required") {
      return badRequest("Google didn’t share an email. Try again or use email signup.");
    }
    if (message === "account_disabled") {
      return unauthorized("This account has been disabled. Contact support.");
    }
    if (message === "legal_required") {
      return badRequest("Please accept all required agreements before continuing with Google.");
    }
    return serverError("Could not complete Google sign-in.");
  }
}
