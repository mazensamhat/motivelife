import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_CONTACT } from "@/lib/legal";

export const metadata = {
  title: "Delete Your Data — MotiveLife",
  description:
    "Request deletion of your MotiveLife account and personal data.",
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
        <h1 className="text-3xl font-semibold text-forward-900">Delete your data</h1>
        <p className="mt-4 text-sm leading-relaxed text-forward-700">
          You can request deletion of your MotiveLife account and the personal information we hold
          about you. This page explains how.
        </p>

        <div className="mt-8 space-y-8 text-forward-700">
          <section>
            <h2 className="text-lg font-semibold text-forward-900">How to request deletion</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                Email{" "}
                <a href={mailto} className="font-medium text-brand-blue hover:underline">
                  {LEGAL_CONTACT.privacy}
                </a>{" "}
                from the email address on your MotiveLife account (or tell us which email you used).
              </li>
              <li>
                Use the subject line <strong>Delete my MotiveLife account</strong>.
              </li>
              <li>We will verify you own the account, then delete your data.</li>
            </ol>
            <p className="mt-4">
              <a
                href={mailto}
                className="inline-flex rounded-xl bg-forward-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forward-800"
              >
                Request account deletion
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">What we delete</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>Account profile (email, name, preferences)</li>
              <li>Goals, tasks, habits, reflections, and voice transcripts you saved</li>
              <li>AI coaching history and Life Graph data tied to your account</li>
              <li>OAuth tokens (e.g. Google Calendar) — disconnects integrations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">What may be kept</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                Stripe billing records we are required to keep for tax and fraud prevention (we do not
                store full card numbers)
              </li>
              <li>Minimal server logs retained for security for a limited time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">Timing</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We aim to complete verified deletion requests within <strong>30 days</strong>. You will
              receive a confirmation email when deletion is finished. Active subscriptions should be
              cancelled first in{" "}
              <Link href="/settings" className="text-brand-blue hover:underline">
                Settings
              </Link>{" "}
              or the Stripe billing portal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">More information</h2>
            <p className="mt-2 text-sm leading-relaxed">
              See our{" "}
              <Link href="/privacy" className="text-brand-blue hover:underline">
                Privacy Policy
              </Link>{" "}
              for how we collect and use data. Questions:{" "}
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
