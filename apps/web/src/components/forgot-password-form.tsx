"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./button";
import { Input, Select } from "./input";
import { Card, CardHeading } from "./card";
import type { SignupCountryCode } from "@/lib/geo/signup-locations";

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
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<SignupCountryCode>("US");
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
        body: JSON.stringify(
          method === "email"
            ? { email }
            : { phone, phoneCountry },
        ),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const payload = (await res.json()) as {
        message?: string;
        requiresPhoneVerification?: boolean;
        redirectTo?: string;
      };

      if (payload.requiresPhoneVerification && payload.redirectTo) {
        router.push(payload.redirectTo);
        return;
      }

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
        Reset via email link or a code sent to your verified phone number.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod("email")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            method === "email"
              ? "bg-accent text-white"
              : "bg-forward-100 text-forward-600 hover:bg-forward-200"
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMethod("phone")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            method === "phone"
              ? "bg-accent text-white"
              : "bg-forward-100 text-forward-600 hover:bg-forward-200"
          }`}
        >
          Phone
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {method === "email" ? (
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
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-forward-700">Country</label>
              <Select
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value as SignupCountryCode)}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forward-700">Phone number</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={
                  phoneCountry === "CA" || phoneCountry === "US"
                    ? "(555) 123-4567"
                    : "Include country code"
                }
                required
              />
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : method === "email" ? "Send reset link" : "Send code"}
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
