"use client";

import Link from "next/link";
import { AI_DISCLOSURE, AGE_MINIMUM, SUBSCRIPTION_DISCLOSURE } from "@/lib/legal";

export interface SignupLegalConsentState {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptAge: boolean;
  acceptAiProcessing: boolean;
  acceptSubscriptionTerms: boolean;
  marketingEmailConsent: boolean;
}

export const EMPTY_SIGNUP_LEGAL: SignupLegalConsentState = {
  acceptTerms: false,
  acceptPrivacy: false,
  acceptAge: false,
  acceptAiProcessing: false,
  acceptSubscriptionTerms: false,
  marketingEmailConsent: false,
};

export function signupLegalComplete(state: SignupLegalConsentState) {
  return (
    state.acceptTerms &&
    state.acceptPrivacy &&
    state.acceptAge &&
    state.acceptAiProcessing &&
    state.acceptSubscriptionTerms
  );
}

function LegalCheckbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer gap-3 text-sm leading-snug text-forward-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-forward-300 text-brand-purple focus:ring-brand-purple"
        required
      />
      <span>{children}</span>
    </label>
  );
}

function OptionalCheckbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer gap-3 text-sm leading-snug text-forward-600">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-forward-300 text-brand-purple focus:ring-brand-purple"
      />
      <span>{children}</span>
    </label>
  );
}

export function SignupLegalConsents({
  value,
  onChange,
}: {
  value: SignupLegalConsentState;
  onChange: (next: SignupLegalConsentState) => void;
}) {
  function set<K extends keyof SignupLegalConsentState>(key: K, v: SignupLegalConsentState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-3 rounded-xl border border-forward-200 bg-forward-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">
        Required before creating an account
      </p>

      <LegalCheckbox
        id="accept-terms"
        checked={value.acceptTerms}
        onChange={(v) => set("acceptTerms", v)}
      >
        I agree to the{" "}
        <Link href="/terms" target="_blank" className="font-medium text-brand-blue hover:underline">
          Terms of Service
        </Link>
        .
      </LegalCheckbox>

      <LegalCheckbox
        id="accept-privacy"
        checked={value.acceptPrivacy}
        onChange={(v) => set("acceptPrivacy", v)}
      >
        I have read and agree to the{" "}
        <Link href="/privacy" target="_blank" className="font-medium text-brand-blue hover:underline">
          Privacy Policy
        </Link>{" "}
        (including how my data is used in Canada and the United States).
      </LegalCheckbox>

      <LegalCheckbox id="accept-age" checked={value.acceptAge} onChange={(v) => set("acceptAge", v)}>
        I am at least {AGE_MINIMUM} years old and not barred from using this service under applicable
        law.
      </LegalCheckbox>

      <LegalCheckbox
        id="accept-ai"
        checked={value.acceptAiProcessing}
        onChange={(v) => set("acceptAiProcessing", v)}
      >
        I understand and consent to AI processing: {AI_DISCLOSURE}
      </LegalCheckbox>

      <LegalCheckbox
        id="accept-subscription"
        checked={value.acceptSubscriptionTerms}
        onChange={(v) => set("acceptSubscriptionTerms", v)}
      >
        I understand subscription billing: {SUBSCRIPTION_DISCLOSURE}
      </LegalCheckbox>

      <OptionalCheckbox
        id="marketing"
        checked={value.marketingEmailConsent}
        onChange={(v) => set("marketingEmailConsent", v)}
      >
        Send me occasional product tips and updates by email (optional — you can unsubscribe anytime;
        required consent under Canadian anti-spam law).
      </OptionalCheckbox>

      <p className="text-xs text-forward-500">
        MotiveLife is not medical, legal, or financial advice. See{" "}
        <Link href="/terms" className="underline-offset-2 hover:underline">
          Terms
        </Link>{" "}
        for full disclaimers.
      </p>
    </div>
  );
}
