import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_CONTACT } from "@/lib/legal";
import { SITE_DOMAIN } from "@/lib/site-url";

export const metadata = {
  title: "Support — MotiveLife",
  description: "Get help with MotiveLife — contact support, billing, and account questions.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-forward-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <BrandLogo href="/" size="nav" className="shrink-0" />
        <Link href="/" className="text-sm text-forward-500 hover:text-forward-900">
          Back home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-semibold text-forward-900">Support</h1>
        <p className="mt-4 text-sm leading-relaxed text-forward-700">
          Need help with MotiveLife at {SITE_DOMAIN}? Email us and we&apos;ll get back to you as soon
          as we can — usually within 1–2 business days.
        </p>

        <section className="mt-8 rounded-2xl border border-forward-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-forward-900">Contact</h2>
          <p className="mt-2 text-sm text-forward-700">
            Email:{" "}
            <a
              href={`mailto:${LEGAL_CONTACT.support}`}
              className="font-medium text-brand-blue hover:underline"
            >
              {LEGAL_CONTACT.support}
            </a>
          </p>
          <p className="mt-3 text-sm text-forward-500">
            Include your account email and a short description of the issue (login, billing, voice
            capture, VYRA AI, etc.).
          </p>
        </section>

        <section className="mt-8 space-y-4 text-sm text-forward-700">
          <h2 className="text-lg font-semibold text-forward-900">Common questions</h2>
          <div>
            <h3 className="font-medium text-forward-900">
              Billing — MyMotiveLife Pro &amp; KINZO AI
            </h3>
            <p className="mt-1 leading-relaxed">
              Plans: MyMotiveLife Pro ($14.99 CAD/month); KINZO AI ($19.99 CAD/month —
              includes full Pro for the owner and Family for up to 6); and Family Pro Upgrade
              ($9.99 CAD/month — full private Pro for active invited Family members). Manage
              subscriptions in Settings → Subscriptions (web) or through your App Store
              subscription if you purchased on iOS. Learn more at{" "}
              <Link href="/family" className="text-brand-blue hover:underline">
                /family
              </Link>
              . You can also email {LEGAL_CONTACT.support} for billing help.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-forward-900">Delete your account or data</h3>
            <p className="mt-1 leading-relaxed">
              In the app, go to{" "}
              <Link href="/settings" className="text-brand-blue hover:underline">
                Settings → Delete account
              </Link>
              . See also our{" "}
              <Link href="/data-deletion" className="text-brand-blue hover:underline">
                data deletion instructions
              </Link>
              , or email {LEGAL_CONTACT.support} if you cannot sign in.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-forward-900">Privacy</h3>
            <p className="mt-1 leading-relaxed">
              Read our{" "}
              <Link href="/privacy" className="text-brand-blue hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-brand-blue hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
