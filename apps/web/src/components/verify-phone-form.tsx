"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./button";
import { Input } from "./input";
import { Card, CardHeading } from "./card";

export function VerifyPhoneForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge") ?? "";
  const purpose = searchParams.get("purpose") ?? "signup";
  const masked = searchParams.get("masked") ?? "your phone";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code, purpose }),
      });
      const data = (await res.json()) as { error?: string; redirectTo?: string };
      if (!res.ok) {
        setError(data.error ?? "Invalid code.");
        return;
      }
      router.push(data.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  if (!challengeId) {
    return (
      <Card className="w-full max-w-md">
        <CardHeading>Verification required</CardHeading>
        <p className="mt-2 text-sm text-forward-500">Missing verification session. Try signing in again.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeading>Enter verification code</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        We sent a 6-digit code to {masked}. It expires in 10 minutes.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">Code</label>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            required
            minLength={6}
            maxLength={6}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
          {loading ? "..." : "Verify"}
        </Button>
      </form>
    </Card>
  );
}
