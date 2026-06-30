import { Suspense } from "react";
import { VerifyPhoneForm } from "@/components/verify-phone-form";
import { Logo } from "@/components/logo";

export default function VerifyPhonePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Logo variant="light" size="lg" href="/" />
      </div>
      <Suspense fallback={<div className="h-64 w-full max-w-md animate-pulse rounded-xl bg-forward-100" />}>
        <VerifyPhoneForm />
      </Suspense>
    </div>
  );
}
