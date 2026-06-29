import Link from "next/link";
import { Logo } from "@/components/logo";
import { AI_DISCLOSURE, LEGAL_CONTACT, LEGAL_VERSION, SUBSCRIPTION_DISCLOSURE } from "@/lib/legal";

export const metadata = {
  title: "Terms of Service — MotiveLife",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-forward-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Logo variant="light" size="sm" href="/" />
        <Link href="/" className="text-sm text-forward-500 hover:text-forward-900">
          Back home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-semibold text-forward-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-forward-500">
          Version {LEGAL_VERSION} · Last updated: June 28, 2026
        </p>
        <p className="mt-4 text-sm leading-relaxed text-forward-700">
          These Terms of Service (&quot;Terms&quot;) govern your use of MotiveLife at motivelife.ai. By
          creating an account, you agree to these Terms and our{" "}
          <Link href="/privacy" className="text-brand-blue hover:underline">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="prose prose-forward mt-8 space-y-8 text-forward-700">
          <section>
            <h2 className="text-lg font-semibold text-forward-900">1. The service</h2>
            <p className="mt-2 text-sm leading-relaxed">
              MotiveLife is a personal life operating system with optional AI coaching, voice capture,
              goals, and subscription features. Features may change over time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">2. Eligibility</h2>
            <p className="mt-2 text-sm leading-relaxed">
              You must be at least 13 years old and able to form a binding contract in your jurisdiction.
              You are responsible for keeping your login credentials secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">3. Account &amp; acceptable use</h2>
            <p className="mt-2 text-sm leading-relaxed">
              You agree not to misuse the service, attempt unauthorized access, scrape or reverse
              engineer the platform, or use MotiveLife for unlawful purposes. You are responsible for
              content you submit (goals, voice, notes).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">4. Subscriptions &amp; billing</h2>
            <p className="mt-2 text-sm leading-relaxed">{SUBSCRIPTION_DISCLOSURE}</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>Taxes may apply depending on your location.</li>
              <li>You may cancel from Settings or the Stripe customer portal.</li>
              <li>Refunds follow Stripe policies and applicable consumer protection law.</li>
              <li>We may change pricing with reasonable notice for future billing periods.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">5. AI features</h2>
            <p className="mt-2 text-sm leading-relaxed">{AI_DISCLOSURE}</p>
            <p className="mt-2 text-sm leading-relaxed">
              AI outputs are automated suggestions. They may be inaccurate. You are solely responsible
              for decisions you make based on MotiveLife content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">6. Not professional advice</h2>
            <p className="mt-2 text-sm leading-relaxed">
              MotiveLife does <strong>not</strong> provide medical, mental health, legal, tax, or
              investment advice. If you are in crisis or need professional help, contact a qualified
              professional or emergency services. Do not rely on MotiveLife for emergency situations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">7. Intellectual property</h2>
            <p className="mt-2 text-sm leading-relaxed">
              MotiveLife owns the platform, branding, and software. You retain ownership of your content.
              You grant us a limited license to host and process your content to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">8. Disclaimer of warranties</h2>
            <p className="mt-2 text-sm leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
              ANY KIND, EXPRESS OR IMPLIED, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">9. Limitation of liability</h2>
            <p className="mt-2 text-sm leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, MOTIVELIFE WILL NOT BE LIABLE FOR INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR
              GOODWILL. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE
              GREATER OF (A) AMOUNTS YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM OR (B) CAD $100.
              Some jurisdictions do not allow certain limitations — in those cases, limits apply to the
              fullest extent permitted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">10. Governing law</h2>
            <p className="mt-2 text-sm leading-relaxed">
              These Terms are governed by the laws of Canada and the province in which MotiveLife
              operates, without regard to conflict-of-law rules. U.S. users also receive the consumer
              protections required by applicable U.S. federal and state law. Courts in Canada shall have
              exclusive jurisdiction except where consumer protection law in your province or state
              requires otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">11. Changes</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We may update these Terms. We will post the new version with an updated date. Material
              changes may require renewed acceptance where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-forward-900">12. Contact</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Questions about these Terms:{" "}
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
