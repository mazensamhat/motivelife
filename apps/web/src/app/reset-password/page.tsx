import { ResetPasswordForm } from "@/components/reset-password-form";
import { BrandLogo } from "@/components/brand-logo";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-forward-50 px-4">
      <div className="mb-8 flex justify-center">
        <BrandLogo href="/" size="lg" priority />
      </div>
      <ResetPasswordForm />
    </div>
  );
}
