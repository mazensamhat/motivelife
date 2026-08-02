"use client";

import { Suspense, useState } from "react";
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
    return <AuthFormInner mode="login" />;
  }
  return (
    <Suspense fallback={<AuthFormInner mode="register" />}>
      <RegisterFormWithParams />
    </Suspense>
  );
}

function RegisterFormWithParams() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? undefined;
  const utm = searchParams.get("utm_source") ?? undefined;
  return (
    <AuthFormInner
      mode="register"
      partnerInviteCode={searchParams.get("partner") ?? undefined}
      referralCode={searchParams.get("ref") ?? undefined}
      circleTag={searchParams.get("tag") ?? undefined}
      plan={plan}
      acquisitionChannel={
        plan === "family" ? "mymotivefamily" : utm
      }
    />
  );
}

function AuthFormInner({
  mode,
  partnerInviteCode,
  referralCode,
  circleTag,
  plan,
  acquisitionChannel,
}: {
  mode: "login" | "register";
  partnerInviteCode?: string;
  referralCode?: string;
  circleTag?: string;
  plan?: string;
  acquisitionChannel?: string;
}) {
  const familyEarlyAccess = mode === "register" && plan === "family";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [legal, setLegal] = useState<SignupLegalConsentState>(EMPTY_SIGNUP_LEGAL);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      window.location.href = payload.redirectTo ?? "/dashboard";
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-md">
      <CardHeading>
        {mode === "login"
          ? "Welcome back"
          : familyEarlyAccess
            ? "MyMotiveFamily early access"
            : "Build My Digital Twin™"}
      </CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        {mode === "login"
          ? "Sign in to continue evolving your Digital Twin."
          : familyEarlyAccess
            ? "Create your account to join Family early access. You’ll get MyMotiveLife Pro while we ship the Intelligent Family Map."
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
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Build My Digital Twin™"}
        </Button>
      </form>
    </Card>
  );
}
