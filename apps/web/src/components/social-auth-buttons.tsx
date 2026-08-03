"use client";

import { useEffect, useRef, useState } from "react";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in isn’t available yet. Use email, or try again later.",
  apple_not_configured: "Apple sign-in isn’t available yet. Use email, or try again later.",
  google_denied: "Google sign-in was cancelled.",
  apple_denied: "Apple sign-in was cancelled.",
  google_invalid: "Google sign-in failed. Please try again.",
  apple_invalid: "Apple sign-in failed. Please try again.",
  google_failed: "Couldn’t complete Google sign-in. Please try again.",
  apple_failed: "Couldn’t complete Apple sign-in. Please try again.",
  google_email_required: "Google didn’t share an email. Allow email access, or use email signup.",
  apple_email_required:
    "Apple didn’t share an email for a new account. Use email signup, or try again with Share My Email.",
  legal_required: "Please accept all required agreements before continuing with Google or Apple.",
  account_disabled: "This account has been disabled. Contact support.",
};

export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return OAUTH_ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again.";
}

type SocialAuthButtonsProps = {
  mode: "login" | "register";
  legalReady: boolean;
  marketingEmailConsent?: boolean;
  plan?: string;
  partnerInviteCode?: string;
  referralCode?: string;
  circleTag?: string;
  acquisitionChannel?: string;
  onError?: (message: string) => void;
};

type ProvidersResponse = {
  google: boolean;
  apple: boolean;
  googleClientId?: string | null;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, config: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>("script[data-google-gis]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis_load_failed")));
      if (window.google?.accounts?.id) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.googleGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis_load_failed"));
    document.head.appendChild(script);
  });
}

export function SocialAuthButtons({
  mode,
  legalReady,
  marketingEmailConsent,
  plan,
  partnerInviteCode,
  referralCode,
  circleTag,
  acquisitionChannel,
  onError,
}: SocialAuthButtonsProps) {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [gisRendered, setGisRendered] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/oauth-providers")
      .then((r) => r.json())
      .then((data: ProvidersResponse) => {
        if (!cancelled) {
          setProviders({
            google: Boolean(data.google),
            apple: Boolean(data.apple),
            googleClientId: data.googleClientId ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setProviders({ google: false, apple: false, googleClientId: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function completeGoogleWithCredential(credential: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/google/id-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential,
          mode,
          plan,
          partnerInviteCode,
          referralCode,
          circleTag,
          acquisitionChannel,
          marketingEmailConsent,
          legalAccepted: mode === "register" ? legalReady : undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        redirectTo?: string;
        error?: string;
      };
      if (!res.ok) {
        onError?.(payload.error ?? "Couldn’t complete Google sign-in.");
        return;
      }
      window.location.href =
        payload.redirectTo ?? (plan === "family" ? "/family-map" : "/dashboard");
    } catch {
      onError?.("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!providers?.google || !providers.googleClientId) return;
    if (mode === "register" && !legalReady) return;
    let cancelled = false;

    void (async () => {
      try {
        await loadGisScript();
        if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: providers.googleClientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) void completeGoogleWithCredential(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "register" ? "signup_with" : "signin_with",
          shape: "pill",
          width: Math.min(googleBtnRef.current.offsetWidth || 360, 400),
        });
        setGisRendered(true);
      } catch {
        setGisRendered(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init when legal/mode/providers change
  }, [providers, mode, legalReady]);

  if (!providers || (!providers.google && !providers.apple)) {
    return null;
  }

  function buildStartUrl(provider: "google" | "apple") {
    const params = new URLSearchParams({ mode });
    if (mode === "register") {
      if (!legalReady) return null;
      params.set("legal", "1");
      if (marketingEmailConsent) params.set("mkt", "1");
    }
    if (plan) params.set("plan", plan);
    if (partnerInviteCode) params.set("partner", partnerInviteCode);
    if (referralCode) params.set("ref", referralCode);
    if (circleTag) params.set("tag", circleTag);
    if (acquisitionChannel) params.set("acq", acquisitionChannel);
    return `/api/auth/${provider}/start?${params.toString()}`;
  }

  function handleAppleClick() {
    const url = buildStartUrl("apple");
    if (!url) {
      window.location.href = `/register?oauth_error=legal_required${plan ? `&plan=${plan}` : ""}`;
      return;
    }
    window.location.href = url;
  }

  function handleGoogleFallbackClick() {
    if (mode === "register" && !legalReady) {
      onError?.("Please accept all required agreements before continuing with Google.");
      return;
    }
    const url = buildStartUrl("google");
    if (!url) return;
    window.location.href = url;
  }

  return (
    <div className="space-y-3">
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-forward-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-white px-3 text-forward-400">Or continue with</span>
        </div>
      </div>
      <div className="grid gap-2">
        {providers.google ? (
          <div className="space-y-2">
            <div
              ref={googleBtnRef}
              className={`flex min-h-11 w-full justify-center overflow-hidden ${
                mode === "register" && !legalReady ? "pointer-events-none opacity-50" : ""
              }`}
            />
            {!gisRendered ? (
              <button
                type="button"
                onClick={handleGoogleFallbackClick}
                disabled={busy || (mode === "register" && !legalReady)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-forward-200 bg-white px-3 text-sm font-semibold text-forward-800 transition hover:bg-forward-50 disabled:opacity-50"
              >
                <GoogleGlyph />
                {busy ? "Signing in…" : "Google"}
              </button>
            ) : null}
          </div>
        ) : null}
        {providers.apple ? (
          <button
            type="button"
            onClick={handleAppleClick}
            disabled={mode === "register" && !legalReady}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-forward-900 bg-forward-950 px-3 text-sm font-semibold text-white transition hover:bg-forward-800 disabled:opacity-50"
          >
            <AppleGlyph />
            Apple
          </button>
        ) : null}
      </div>
      {mode === "register" && !legalReady ? (
        <p className="text-xs text-forward-500">
          Accept the required agreements above to continue with Google or Apple.
        </p>
      ) : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M12.7 8.6c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.3-2.5-1.4-1.1-.1-2.1.6-2.6.6-.5 0-1.4-.6-2.3-.6-1.2 0-2.3.7-2.9 1.8-1.2 2.1-.3 5.2.9 6.9.6.8 1.3 1.7 2.2 1.7.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6c1 0 1.6-.8 2.2-1.6.7-.9 1-1.8 1-1.8s-1.9-.7-1.9-2.9zM10.5 3.5c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1.1z" />
    </svg>
  );
}
