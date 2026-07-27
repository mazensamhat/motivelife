import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { AI_DISCLOSURE, LEGAL_CONTACT, LEGAL_VERSION, SUBSCRIPTION_DISCLOSURE } from "@/lib/legal";
import { SITE_DOMAIN } from "@/lib/site-url";

export const metadata = {
  title: "Privacy Policy — MotiveLife",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-forward-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <BrandLogo href="/" size="nav" className="shrink-0" />
        <Link href="/" className="text-sm text-forward-500 hover:text-forward-900">
          Back home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-semibold text-forward-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-forward-500">
          Version {LEGAL_VERSION} · Last updated: July 27, 2026
        </p>
        <p className="mt-4 text-sm leading-relaxed text-forward-700">
          This Privacy Policy describes how {LEGAL_CONTACT.company} (&quot;MotiveLife,&quot; &quot;we,&quot;
          &quot;us&quot;) collects, uses, and shares personal information when you use MotiveLife on the
          web ({SITE_DOMAIN}), the iOS App Store app, and the Google Play Android app. It is designed to
          meet transparency expectations under Canada&apos;s{" "}
          <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and
          common U.S. state privacy requirements. If you are in Quebec, additional provincial rules may
          apply.
        </p>

        <div className="prose prose-forward mt-8 space-y-8 text-forward-700">
          <section id="collect">
            <h2 className="text-lg font-semibold text-forward-900">1. Information we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Account data:</strong> email, name (optional), password (stored hashed),
                optional birth year / generation, optional phone and location if you provide them,
                subscription status.
              </li>
              <li>
                <strong>Life OS data:</strong> goals, tasks, habits, reflections, voice transcripts,
                coaching preferences, and progress you choose to save.
              </li>
              <li>
                <strong>Calendar data (optional):</strong> if you connect Google Calendar at{" "}
                <Link href="/integrations" className="text-brand-blue hover:underline">
                  Integrations
                </Link>
                , we access read-only event titles, times, and locations from calendars you authorize
                to personalize briefings. We do not modify or delete your calendar events.
              </li>
              <li>
                <strong>Health data (optional, Android):</strong> if you choose{" "}
                <strong>Sync Health Connect</strong> in the Android app, we read only the health
                metrics you authorize for fitness coaching and Life Score — typically steps, sleep,
                resting heart rate, and exercise/activity duration. We do <strong>not</strong> sell
                health data, use it for advertising, or share it with third parties for their own
                marketing. Sync is user-initiated; you can deny or revoke Health Connect permissions
                anytime in Android settings.
              </li>
              <li>
                <strong>Profile photo (optional):</strong> if you add a photo, we store the image you
                select (or capture) for your Life Circle profile. On Android we use the system photo
                picker / camera for one-time selection — we do not request broad access to your entire
                photo library.
              </li>
              <li>
                <strong>Microphone (optional):</strong> used for Voice Organize when you choose to
                speak notes; audio is processed to create transcripts/tasks you save.
              </li>
              <li>
                <strong>Payment data:</strong> processed by Stripe (web) or Apple / Google in-app
                purchase systems (native apps). We receive subscription status — not full card numbers
                from those stores.
              </li>
              <li>
                <strong>Technical data:</strong> session cookies (essential for login on web),
                device/browser or app version, server logs for security, and aggregated page-view
                analytics on web (see below). Analytics are not used inside the native App Store /
                Play shells for advertising tracking.
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

          <section id="analytics">
            <h2 className="text-lg font-semibold text-forward-900">4. Analytics</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We use <strong>Vercel Analytics</strong> for privacy-friendly, aggregated traffic
              measurement on our website and app (page views, referrers, and coarse device/browser
              categories). Vercel does not use this product for cross-site advertising profiles. We also
              record anonymized page paths on our servers to understand feature usage. We do not use
              analytics data to make automated decisions about you.
            </p>
          </section>

          <section id="sharing">
            <h2 className="text-lg font-semibold text-forward-900">5. Service providers</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Stripe</strong> — payments (US)
              </li>
              <li>
                <strong>OpenAI</strong> — optional AI processing (US)
              </li>
              <li>
                <strong>Google</strong> — optional Calendar OAuth (read-only calendar access when you
                connect); Android Health Connect on-device APIs when you sync health metrics; Google
                Play Billing for Android subscriptions
              </li>
              <li>
                <strong>Apple</strong> — App Store / In-App Purchase for iOS subscriptions when you
                purchase in the iOS app
              </li>
              <li>
                <strong>Supabase</strong> — database hosting
              </li>
              <li>
                <strong>Vercel</strong> — application hosting and analytics
              </li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed">
              Data may be stored or processed in Canada, the United States, or other countries where
              these providers operate. We use contractual and technical safeguards appropriate for
              cross-border transfers.
            </p>
          </section>

          <section id="deletion">
            <h2 className="text-lg font-semibold text-forward-900">Account &amp; data deletion</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Signed-in users can permanently delete their account in{" "}
              <Link href="/settings" className="text-brand-blue hover:underline">
                Settings → Delete account
              </Link>
              . Full instructions (including help if you cannot sign in) are on our{" "}
              <Link href="/data-deletion" className="text-brand-blue hover:underline">
                data deletion page
              </Link>
              . You may also email{" "}
              <a href={`mailto:${LEGAL_CONTACT.privacy}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>
              .
            </p>
          </section>

          <section id="canada">
            <h2 className="text-lg font-semibold text-forward-900">6. Your rights (Canada — PIPEDA)</h2>
            <p className="mt-2 text-sm leading-relaxed">
              You may request access to, correction of, or deletion of your personal information, subject
              to legal exceptions. You may withdraw consent for optional processing (such as marketing,
              analytics where applicable, calendar connection, or AI) where applicable. Contact us at{" "}
              <a href={`mailto:${LEGAL_CONTACT.privacy}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>
              . You may file a complaint with the Office of the Privacy Commissioner of Canada if you
              believe your privacy rights have been violated.
            </p>
          </section>

          <section id="us">
            <h2 className="text-lg font-semibold text-forward-900">7. U.S. residents</h2>
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
            <h2 className="text-lg font-semibold text-forward-900">8. Marketing (CASL — Canada)</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We only send promotional emails if you opt in at registration or later. Every marketing
              email includes an unsubscribe link. Transactional emails (billing, security, service
              updates) may still be sent.
            </p>
          </section>

          <section id="children">
            <h2 className="text-lg font-semibold text-forward-900">9. Children</h2>
            <p className="mt-2 text-sm leading-relaxed">
              MotiveLife is not directed to children under 13 (U.S. COPPA). You must confirm you are at
              least 13 to register. We do not knowingly collect data from children under 13. Contact us
              to request deletion if you believe a child has registered.
            </p>
          </section>

          <section id="retention">
            <h2 className="text-lg font-semibold text-forward-900">10. Retention &amp; security</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We retain account data while your account is active and for a reasonable period afterward
              for legal, tax, and fraud-prevention purposes. Billing records may be retained as required
              by law. We use encryption in transit, hashed passwords, and access controls — no system is
              100% secure.
            </p>
          </section>

          <section id="subscription">
            <h2 className="text-lg font-semibold text-forward-900">11. Subscriptions</h2>
            <p className="mt-2 text-sm leading-relaxed">{SUBSCRIPTION_DISCLOSURE}</p>
          </section>

          <section id="changes">
            <h2 className="text-lg font-semibold text-forward-900">12. Changes</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We may update this policy. Material changes will be posted here with a new version date.
              Continued use after changes constitutes acceptance where permitted by law.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-lg font-semibold text-forward-900">13. Contact</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Privacy inquiries and general support:{" "}
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
