import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_CONTACT } from "@/lib/legal";

export const metadata = {
  title: "Delete Your Account — MotiveLife",
  description:
    "Permanently delete your MotiveLife account and personal data from Settings, or request help by email.",
};

export default function DataDeletionPage() {
  const mailto = `mailto:${LEGAL_CONTACT.privacy}?subject=${encodeURIComponent("Delete my MotiveLife account")}&body=${encodeURIComponent("Please delete my MotiveLife account and associated data.\n\nRegistered email:\n\n(Optional) Reason for leaving:\n")}`;

  return (
    <div className="min-h-screen bg-forward-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <BrandLogo href="/" size="nav" className="shrink-0" />
        <Link href="/privacy" className="text-sm text-forward-500 hover:text-forward-900">
          Privacy Policy
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-semibold text-forward-900">Delete your account</h1>
        <p className="mt-4 text-sm leading-relaxed text-forward-700">
          MotiveLife lets you permanently delete your account and associated personal data. Prefer
          the in-app flow when you are signed in.
        </p>

        <div className="mt-8 space-y-8 text-forward-700">
          <section>
            <h2 className="text-lg font-semibold text-forward-900">Delete in the app (recommended)</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                Sign in to MotiveLife (web or the iOS app).
              </li>
              <li>
                Open{" "}
                <Link href="/settings" className="font-medium text-brand-blue hover:underline">
                  Settings
                </Link>
                .
              </li>
              <li>
                Scroll to <strong>Delete account</strong>, tap <strong>Delete my account</strong>,
                type <strong>DELETE</strong>, enter your password, and confirm.
              </li>
            </ol>
            <p className="mt-4">
              <Link
                href="/settings"
                className="inline-flex rounded-xl bg-forward-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forward-800"
              >
                Go to Settings
              </Link>
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              Deletion is permanent. Your session ends immediately when the account is removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">Need help by email?</h2>
            <p className="mt-2 text-sm leading-relaxed">
              If you cannot sign in, email{" "}
              <a href={mailto} className="font-medium text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>{" "}
              from the address on your account with the subject{" "}
              <strong>Delete my MotiveLife account</strong>. We will verify ownership and complete
              deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">What we delete</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>Account profile (email, name, preferences)</li>
              <li>Goals, tasks, habits, reflections, and voice transcripts you saved</li>
              <li>AI coaching history and Life Graph data tied to your account</li>
              <li>OAuth tokens (e.g. Google Calendar, Fitbit) — disconnects integrations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">What may be kept</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                Billing records we are required to keep for tax and fraud prevention (we do not
                store full card numbers)
              </li>
              <li>Minimal server logs retained for security for a limited time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">Subscriptions</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Cancel an active App Store subscription in iOS Settings → Apple ID → Subscriptions
              (or Settings → Subscriptions in the app). Web Stripe subscriptions for MyMotiveLife
              Pro can be cancelled in Settings before or after account deletion. MyMotiveFamily
              household access ends when you leave the household or delete your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">More information</h2>
            <p className="mt-2 text-sm leading-relaxed">
              See our{" "}
              <Link href="/privacy" className="text-brand-blue hover:underline">
                Privacy Policy
              </Link>
              . Questions:{" "}
              <a href={`mailto:${LEGAL_CONTACT.support}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.support}
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
