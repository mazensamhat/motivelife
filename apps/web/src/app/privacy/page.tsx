import Link from "next/link";
import { Logo } from "@/components/logo";
import { AI_DISCLOSURE, LEGAL_CONTACT, LEGAL_VERSION, SUBSCRIPTION_DISCLOSURE } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy — MotiveLife",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-forward-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Logo variant="light" size="sm" href="/" />
        <Link href="/" className="text-sm text-forward-500 hover:text-forward-900">
          Back home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-semibold text-forward-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-forward-500">
          Version {LEGAL_VERSION} · Last updated: June 28, 2026
        </p>
        <p className="mt-4 text-sm leading-relaxed text-forward-700">
          This Privacy Policy describes how {LEGAL_CONTACT.company} (&quot;MotiveLife,&quot; &quot;we,&quot;
          &quot;us&quot;) collects, uses, and shares personal information when you use motivelife.ai. It
          is designed to meet transparency expectations under Canada&apos;s{" "}
          <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and
          common U.S. state privacy requirements. If you are in Quebec, additional provincial rules may
          apply.
        </p>

        <div className="prose prose-forward mt-8 space-y-8 text-forward-700">
          <section id="collect">
            <h2 className="text-lg font-semibold text-forward-900">1. Information we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Account data:</strong> email, name, password (stored hashed), birth year /
                generation, subscription status.
              </li>
              <li>
                <strong>Life OS data:</strong> goals, tasks, habits, reflections, voice transcripts,
                coaching preferences, and progress you choose to save.
              </li>
              <li>
                <strong>Payment data:</strong> processed by Stripe. We receive customer IDs and
                subscription status — not full card numbers.
              </li>
              <li>
                <strong>Technical data:</strong> session cookies (essential for login), device/browser
                type, and server logs for security.
              </li>
              <li>
                <strong>Consent records:</strong> timestamps when you accept Terms, Privacy Policy, and
                optional marketing consent.
              </li>
            </ul>
          </section>

          <section id="use">
            <h2 className="text-lg font-semibold text-forward-900">2. How we use information</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We use your information to provide MotiveLife (briefings, reviews, voice organize,
              coaching), process subscriptions, secure the service, comply with law, and — only if you
              opt in — send product emails. We do <strong>not</strong> sell your personal information.
            </p>
          </section>

          <section id="ai">
            <h2 className="text-lg font-semibold text-forward-900">3. AI &amp; voice processing</h2>
            <p className="mt-2 text-sm leading-relaxed">{AI_DISCLOSURE}</p>
            <p className="mt-2 text-sm leading-relaxed">
              Voice captures may contain sensitive personal information. We ask for explicit consent at
              signup before enabling AI features. You may still use rule-based features when AI limits
              are reached or AI is disabled.
            </p>
          </section>

          <section id="sharing">
            <h2 className="text-lg font-semibold text-forward-900">4. Service providers</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Stripe</strong> — payments (US)
              </li>
              <li>
                <strong>OpenAI</strong> — optional AI processing (US)
              </li>
              <li>
                <strong>Supabase / hosting providers</strong> — database and infrastructure
              </li>
              <li>
                <strong>Vercel</strong> — application hosting
              </li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed">
              Data may be stored or processed in Canada, the United States, or other countries where
              these providers operate. We use contractual and technical safeguards appropriate for
              cross-border transfers.
            </p>
          </section>

          <section id="canada">
            <h2 className="text-lg font-semibold text-forward-900">5. Your rights (Canada — PIPEDA)</h2>
            <p className="mt-2 text-sm leading-relaxed">
              You may request access to, correction of, or deletion of your personal information, subject
              to legal exceptions. You may withdraw consent for optional processing (such as marketing
              or AI) where applicable. Contact us at{" "}
              <a href={`mailto:${LEGAL_CONTACT.privacy}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>
              . You may file a complaint with the Office of the Privacy Commissioner of Canada if you
              believe your privacy rights have been violated.
            </p>
          </section>

          <section id="us">
            <h2 className="text-lg font-semibold text-forward-900">6. U.S. residents</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Depending on your state (e.g., California, Virginia, Colorado), you may have rights to
              know, access, delete, or correct personal information, and to opt out of certain
              processing. We do not sell personal information. To exercise rights, email{" "}
              <a href={`mailto:${LEGAL_CONTACT.privacy}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>
              . We will verify your request before responding.
            </p>
          </section>

          <section id="marketing">
            <h2 className="text-lg font-semibold text-forward-900">7. Marketing (CASL — Canada)</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We only send promotional emails if you opt in at registration or later. Every marketing
              email includes an unsubscribe link. Transactional emails (billing, security, service
              updates) may still be sent.
            </p>
          </section>

          <section id="children">
            <h2 className="text-lg font-semibold text-forward-900">8. Children</h2>
            <p className="mt-2 text-sm leading-relaxed">
              MotiveLife is not directed to children under 13 (U.S. COPPA). You must confirm you are at
              least 13 to register. We do not knowingly collect data from children under 13. Contact us
              to request deletion if you believe a child has registered.
            </p>
          </section>

          <section id="retention">
            <h2 className="text-lg font-semibold text-forward-900">9. Retention &amp; security</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We retain account data while your account is active and for a reasonable period afterward
              for legal, tax, and fraud-prevention purposes. Billing records may be retained as required
              by law. We use encryption in transit, hashed passwords, and access controls — no system is
              100% secure.
            </p>
          </section>

          <section id="subscription">
            <h2 className="text-lg font-semibold text-forward-900">10. Subscriptions</h2>
            <p className="mt-2 text-sm leading-relaxed">{SUBSCRIPTION_DISCLOSURE}</p>
          </section>

          <section id="changes">
            <h2 className="text-lg font-semibold text-forward-900">11. Changes</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We may update this policy. Material changes will be posted here with a new version date.
              Continued use after changes constitutes acceptance where permitted by law.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-lg font-semibold text-forward-900">12. Contact</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Privacy inquiries:{" "}
              <a href={`mailto:${LEGAL_CONTACT.privacy}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>
              <br />
              General support:{" "}
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
