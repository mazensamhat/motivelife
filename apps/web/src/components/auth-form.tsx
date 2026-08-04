"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./button";
import { Input } from "./input";
import { Card, CardHeading } from "./card";
import {
  EMPTY_SIGNUP_LEGAL,
  SignupLegalConsents,
  signupLegalComplete,
  type SignupLegalConsentState,
} from "./signup-legal-consents";
import { SocialAuthButtons, oauthErrorMessage } from "./social-auth-buttons";

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    if (res.status === 401) return "Invalid email or password.";
    if (res.status >= 500) return "Server error. Restart the app and try again.";
    return "Something went wrong.";
  }
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error ?? "Something went wrong.";
  } catch {
    if (res.status === 401) return "Invalid email or password.";
    return "Something went wrong.";
  }
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  // Login must not wait on Suspense — App Review taps Sign in immediately.
  if (mode === "login") {
    return (
      <Suspense fallback={<AuthFormInner mode="login" />}>
        <LoginFormWithParams />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<AuthFormInner mode="register" />}>
      <RegisterFormWithParams />
    </Suspense>
  );
}

function LoginFormWithParams() {
  const searchParams = useSearchParams();
  return (
    <AuthFormInner
      mode="login"
      familyInviteCode={searchParams.get("family") ?? undefined}
      plan={searchParams.get("plan") ?? undefined}
      oauthError={searchParams.get("oauth_error")}
    />
  );
}

function RegisterFormWithParams() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? undefined;
  const utm = searchParams.get("utm_source") ?? undefined;
  const familyInviteCode = searchParams.get("family") ?? undefined;
  return (
    <AuthFormInner
      mode="register"
      partnerInviteCode={searchParams.get("partner") ?? undefined}
      familyInviteCode={familyInviteCode}
      referralCode={searchParams.get("ref") ?? undefined}
      circleTag={searchParams.get("tag") ?? undefined}
      plan={plan}
      acquisitionChannel={
        plan === "family" || familyInviteCode ? "mymotivefamily" : utm
      }
      oauthError={searchParams.get("oauth_error")}
    />
  );
}

function AuthFormInner({
  mode,
  partnerInviteCode,
  familyInviteCode,
  referralCode,
  circleTag,
  plan,
  acquisitionChannel,
  oauthError,
}: {
  mode: "login" | "register";
  partnerInviteCode?: string;
  familyInviteCode?: string;
  referralCode?: string;
  circleTag?: string;
  plan?: string;
  acquisitionChannel?: string;
  oauthError?: string | null;
}) {
  const familyEarlyAccess =
    mode === "register" && (plan === "family" || Boolean(familyInviteCode));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [legal, setLegal] = useState<SignupLegalConsentState>(EMPTY_SIGNUP_LEGAL);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const msg = oauthErrorMessage(oauthError);
    if (msg) setError(msg);
  }, [oauthError]);

  useEffect(() => {
    if (mode !== "login" || typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("oauth_error");
    const msg = oauthErrorMessage(code);
    if (msg) setError(msg);
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "register" && !signupLegalComplete(legal)) {
      setError("Please accept all required agreements before creating your account.");
      setLoading(false);
      return;
    }

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "register"
        ? {
            email,
            password,
            name: name.trim() || undefined,
            ...(partnerInviteCode ? { partnerInviteCode } : {}),
            ...(familyInviteCode
              ? {
                  familyInviteCode: familyInviteCode.trim(),
                  signupIntent: "family_invite" as const,
                }
              : {}),
            ...(referralCode ? { referralCode } : {}),
            ...(circleTag ? { circleTag } : {}),
            acquisitionChannel,
            acceptTerms: legal.acceptTerms,
            acceptPrivacy: legal.acceptPrivacy,
            acceptAge: legal.acceptAge,
            acceptAiProcessing: legal.acceptAiProcessing,
            acceptSubscriptionTerms: legal.acceptSubscriptionTerms,
            marketingEmailConsent: legal.marketingEmailConsent,
          }
        : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const payload = (await res.json()) as { redirectTo?: string };
      const familyCode = familyInviteCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const serverRedirect = payload.redirectTo;
      const isAdminRedirect = Boolean(serverRedirect?.startsWith("/admin"));
      window.location.href = isAdminRedirect
        ? serverRedirect!
        : familyCode
          ? `/family/join/${encodeURIComponent(familyCode)}`
          : (serverRedirect ?? (plan === "family" ? "/family-map" : "/dashboard"));
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const legalReady = mode === "login" || signupLegalComplete(legal);

  return (
    <Card className="relative z-10 w-full max-w-md">
      <CardHeading>
        {mode === "login"
          ? "Welcome back"
          : familyEarlyAccess
            ? "Create your Family account"
            : "Build My Digital Twin™"}
      </CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        {mode === "login"
          ? familyInviteCode
            ? "Sign in and you’ll join the family invite automatically."
            : "Sign in to continue evolving your Digital Twin."
          : familyInviteCode
            ? "You’ll join the family map right away. Full MyMotiveLife Pro is not included — Family is free for members; unlock private Pro later for $9.99/mo while your household is on MyMotiveFamily."
            : familyEarlyAccess
              ? "Includes a 14-day MyMotiveLife Pro trial (no card). Family Map live location is free forever — unlock Family Intelligence later for $19.99 CAD/mo via Stripe."
              : partnerInviteCode || referralCode
                ? "You're joining someone's Life Circle — and starting your own Digital Twin."
                : "Create your account to awaken a living Digital Twin that learns your life."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === "register" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-forward-700">
              Name <span className="font-normal text-forward-400">(optional)</span>
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        {mode === "register" && <SignupLegalConsents value={legal} onChange={setLegal} />}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : familyInviteCode
                ? "Join family"
                : "Build My Digital Twin™"}
        </Button>
      </form>

      <div className="mt-5">
        <SocialAuthButtons
          mode={mode}
          legalReady={legalReady}
          marketingEmailConsent={legal.marketingEmailConsent}
          plan={plan ?? (familyInviteCode ? "family" : undefined)}
          partnerInviteCode={partnerInviteCode}
          familyInviteCode={familyInviteCode}
          referralCode={referralCode}
          circleTag={circleTag}
          acquisitionChannel={acquisitionChannel}
          onError={setError}
        />
      </div>
    </Card>
  );
}
