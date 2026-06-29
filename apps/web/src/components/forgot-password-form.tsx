"use client";

import { useState } from "react";
import Link from "next/link";
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

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const payload = (await res.json()) as { message?: string };
      setMessage(payload.message ?? "Check your email for a reset link.");
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeading>Reset your password</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        Enter your email and we&apos;ll send you a link to choose a new password.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-forward-500">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
