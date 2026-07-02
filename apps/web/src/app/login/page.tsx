import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-forward-50 px-4">
      <div className="relative z-10 mb-8 flex justify-center">
        <Logo variant="light" size="lg" href="/" showTagline className="shrink-0" />
      </div>
      <AuthForm mode="login" />
      <p className="mt-4 text-sm text-forward-500">
        <Link href="/forgot-password" className="font-medium text-accent hover:underline">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-4 text-sm text-forward-500">
        No account?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
