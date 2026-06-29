"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./button";
import { Input } from "./input";
import { Card, CardHeading } from "./card";

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return "Something went wrong.";
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-forward-100" />}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}

function ResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid. Request a new one.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const payload = (await res.json()) as { redirectTo?: "/admin" | "/dashboard" };
      router.push(payload.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeading>Invalid reset link</CardHeading>
        <p className="mt-2 text-sm text-forward-500">
          This link is missing or expired. Request a new password reset email.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-accent hover:underline">
            Request reset link
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeading>Choose a new password</CardHeading>
      <p className="mt-1 text-sm text-forward-500">Must be at least 8 characters.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">New password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">Confirm password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : "Update password"}
        </Button>
      </form>
    </Card>
  );
}
