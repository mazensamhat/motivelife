"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./button";
import { Input, Select } from "./input";
import { Card, CardHeading } from "./card";
import { GENERATIONS, birthYearFromGeneration, type Generation } from "@/lib/generation";
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
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-forward-100" />}>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}

function AuthFormInner({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerInviteCode = mode === "register" ? searchParams.get("partner") : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [generation, setGeneration] = useState<Generation>("MILLENNIAL");
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
            name,
            birthYear: birthYearFromGeneration(generation),
            ...(partnerInviteCode ? { partnerInviteCode } : {}),
            acquisitionChannel:
              searchParams.get("ref") ??
              searchParams.get("utm_source") ??
              undefined,
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

      const payload = (await res.json()) as { redirectTo?: "/admin" | "/dashboard" };
      router.push(payload.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Is motivelife.ai running on port 3002?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeading>{mode === "login" ? "Welcome back" : "Create your account"}</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        {mode === "login"
          ? "Sign in to continue moving forward."
          : partnerInviteCode
            ? "You're joining as someone's accountability partner."
            : "Start making better life decisions today."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-forward-700">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forward-700">Your generation</label>
              <Select
                value={generation}
                onChange={(e) => setGeneration(e.target.value as Generation)}
              >
                {GENERATIONS.map((g) => (
                  <option key={g} value={g}>
                    {g === "GEN_Z"
                      ? "Gen Z (16–24)"
                      : g === "MILLENNIAL"
                        ? "Millennials (25–34)"
                        : g === "GEN_X"
                          ? "Gen X (35–44)"
                          : "Boomers & Beyond (45+)"}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>
        {mode === "register" && <SignupLegalConsents value={legal} onChange={setLegal} />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={loading || (mode === "register" && !signupLegalComplete(legal))}
        >
          {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
