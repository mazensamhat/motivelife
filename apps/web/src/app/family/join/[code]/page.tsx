"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { buttonClassName } from "@/components/button";
import {
  familyInviteLoginHref,
  familyInviteRegisterHref,
  normalizeFamilyInviteCode,
} from "@/lib/family-map/invite-link";

type Peek = {
  valid: boolean;
  name?: string;
  memberCount?: number;
  code?: string;
};

export default function FamilyJoinInvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = normalizeFamilyInviteCode(String(params.code ?? ""));
  const [peek, setPeek] = useState<Peek | null>(null);
  const [status, setStatus] = useState<"loading" | "need_auth" | "joining" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || code.length < 4) {
      setStatus("error");
      setError("That invite link looks incomplete.");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const peekRes = await fetch(`/api/family/invite/${encodeURIComponent(code)}`);
        const peekJson = (await peekRes.json().catch(() => ({ valid: false }))) as Peek;
        if (cancelled) return;
        setPeek(peekJson);
        if (!peekJson.valid) {
          setStatus("error");
          setError("This invite link isn’t valid anymore. Ask your family for a new one.");
          return;
        }

        const joinRes = await fetch("/api/family/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        if (cancelled) return;

        if (joinRes.status === 401) {
          setStatus("need_auth");
          return;
        }

        if (!joinRes.ok) {
          const body = (await joinRes.json().catch(() => ({}))) as { error?: string };
          setStatus("error");
          setError(body.error ?? "Could not join this family.");
          return;
        }

        setStatus("joining");
        router.replace("/family-map?joined=1");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Something went wrong. Check your connection and try again.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  const familyName = peek?.name?.trim() || "a MotiveLife family";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-forward-50 px-4 pb-28">
      <BrandLogo href="/" size="lg" className="mb-8" />
      <div className="w-full max-w-md rounded-3xl border border-forward-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
          MyMotiveFamily
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-forward-900">
          {status === "need_auth" ? `Join ${familyName}` : "Family invite"}
        </h1>

        {status === "loading" || status === "joining" ? (
          <p className="mt-3 text-sm text-forward-600">
            {status === "joining" ? "Adding you to the family…" : "Opening invite…"}
          </p>
        ) : null}

        {status === "need_auth" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-forward-600">
              You’ve been invited to <strong className="text-forward-900">{familyName}</strong>
              {peek?.memberCount != null ? ` (${peek.memberCount} people)` : ""}. Create a free
              account or sign in — you’ll join automatically.
            </p>
            <Link
              href={familyInviteRegisterHref(code)}
              className={buttonClassName({ size: "lg", className: "w-full" })}
            >
              Create account & join
            </Link>
            <Link
              href={familyInviteLoginHref(code)}
              className={buttonClassName({
                size: "lg",
                variant: "secondary",
                className: "w-full",
              })}
            >
              Sign in & join
            </Link>
            <p className="text-center font-mono text-xs tracking-widest text-forward-400">
              Code {code}
            </p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-red-700">{error}</p>
            <Link href="/family-map" className={buttonClassName({ variant: "secondary" })}>
              Open Family Map
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
