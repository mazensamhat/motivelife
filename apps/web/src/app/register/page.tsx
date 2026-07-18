import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-forward-50 px-4 pb-28">
      <div className="relative z-10 mb-8 flex justify-center">
        <BrandLogo href="/" size="lg" priority className="shrink-0" />
      </div>
      <AuthForm mode="register" />
      <p className="mt-4 max-w-md text-center text-xs text-forward-500">
        By creating an account you will be asked to accept our{" "}
        <Link href="/terms" className="underline-offset-2 hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="mt-6 text-sm text-forward-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
