import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Logo variant="light" size="lg" href="/" />
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
