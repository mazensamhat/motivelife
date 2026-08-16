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
          Version {LEGAL_VERSION} · Last updated: August 16, 2026
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
                <strong>Kashu (Cash-Flow Intelligence) financial data (optional):</strong> if you use
                Kashu, we store operating balances, payday settings, safety floor / emergency
                buffers, bill and commitment entries, uploaded statement text (PDF/CSV/paste),
                parsed transactions, recurring suggestions you confirm or dismiss, and Transition Mode
                checklist notes. Kashu does <strong>not</strong> require bank login or bank
                aggregation — you upload or enter data yourself. Financial data stays on your account
                and is not shared with other users. See{" "}
                <Link href="/cash-flow" className="text-brand-blue hover:underline">
                  Kashu
                </Link>
                .
              </li>
              <li>
                <strong>KINZO AI (MyMotiveFamily) location &amp; household data (optional):</strong> if you join a
                household and enable location sharing, we collect GPS coordinates, accuracy, speed,
                heading, battery level (when available), presence status (e.g. stationary / moving /
                driving), a phone-in-use while driving signal (on Android: screen on and unlocked; on
                iOS: MotiveLife open on screen), place labels you or your household configure, trip
                and place-history signals used for family intelligence, vehicle details you enter for
                fuel estimates, and household membership / invite information. See{" "}
                <a href="#family-location" className="text-brand-blue hover:underline">
                  Section 2
                </a>
                .
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
                select (or capture) for your Life Circle / Family Map profile. On Android we use the
                system photo picker / camera for one-time selection — we do not request broad access to
                your entire photo library.
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

          <section id="family-location">
            <h2 className="text-lg font-semibold text-forward-900">
              2. KINZO AI (MyMotiveFamily) location sharing
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              KINZO AI (MyMotiveFamily) is optional. Location is collected only when you grant OS location
              permission <strong>and</strong> enable sharing for a household you belong to. When you
              turn on live sharing, MotiveLife may request <strong>Always / Allow all the time</strong>{" "}
              (background) location so your household can see updates while the app is not open —
              similar to other family safety maps. You can leave sharing at While Using only, or turn
              sharing off anytime. Android may show an ongoing notification while background sharing is
              active.
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Who can see your location:</strong> members of the household (or location
                circle) you join, subject to your sharing level. We do not publish your live location
                publicly.
              </li>
              <li>
                <strong>Sharing levels you control:</strong> Precise, Approximate, Destination only,
                ETA only, Driving status only, or Off. Additional toggles may limit driving data,
                place history, routine learning, and family insights.
              </li>
              <li>
                <strong>How to change or stop sharing:</strong> set sharing to Off or a narrower level
                in Family Map privacy controls, revoke OS location permission in system Settings, leave
                the household, or delete your account.
              </li>
              <li>
                <strong>What we store in the cloud:</strong> your latest shared position and related
                presence fields on your household member record, plus short-lived location events,
                recent trips, places, and routine aggregates used for family intelligence. Household
                owners and members should only invite people who consent to this sharing.
              </li>
              <li>
                <strong>On-device drive history:</strong> richer route history (paths, day/month/year
                browse, fuel and speed insights) can be saved in your browser / app storage on this
                phone while live sharing is on. That history stays under your control on the device —
                you can delete individual drives or clear all of it anytime. It is not the same as
                continuous background tracking.
              </li>
              <li>
                <strong>Children &amp; teens:</strong> MotiveLife is not directed to children under 13.
                Guardians who add younger household members are responsible for appropriate consent and
                for using age-appropriate sharing levels.
              </li>
              <li>
                <strong>Map display:</strong> KINZO AI uses third-party map tiles (e.g. OpenStreetMap
                / CARTO) plus optional Esri satellite imagery to render the map view. Tile requests
                are based on the map viewport; they are not a sale of your personal location data.
              </li>
            </ul>
          </section>

          <section id="use">
            <h2 className="text-lg font-semibold text-forward-900">3. How we use information</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We use your information to provide MotiveLife and KINZO AI (MyMotiveFamily) (briefings, reviews,
              voice organize, coaching, household map and family intelligence), process subscriptions,
              secure the service, comply with law, and — only if you opt in — send product emails. We
              do <strong>not</strong> sell your personal information, including location.
            </p>
          </section>

          <section id="ai">
            <h2 className="text-lg font-semibold text-forward-900">4. AI &amp; voice processing</h2>
            <p className="mt-2 text-sm leading-relaxed">{AI_DISCLOSURE}</p>
            <p className="mt-2 text-sm leading-relaxed">
              Voice captures may contain sensitive personal information. We ask for explicit consent at
              signup before enabling AI features. You may still use rule-based features when AI limits
              are reached or AI is disabled.
            </p>
          </section>

          <section id="analytics">
            <h2 className="text-lg font-semibold text-forward-900">5. Analytics</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We use <strong>Vercel Analytics</strong> for privacy-friendly, aggregated traffic
              measurement on our website and app (page views, referrers, and coarse device/browser
              categories). Vercel does not use this product for cross-site advertising profiles. We also
              record anonymized page paths on our servers to understand feature usage. We do not use
              analytics data to make automated decisions about you.
            </p>
          </section>

          <section id="sharing">
            <h2 className="text-lg font-semibold text-forward-900">6. Service providers</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Stripe</strong> — payments (US)
              </li>
              <li>
                <strong>OpenAI</strong> — optional AI processing (US)
              </li>
              <li>
                <strong>Google</strong> — optional Sign in with Google for account creation/login;
                optional Calendar OAuth (calendar access when you connect); Android Health Connect
                on-device APIs when you sync health metrics; Google Play Billing for Android
                subscriptions
              </li>
              <li>
                <strong>Apple</strong> — optional Sign in with Apple for account creation/login; App
                Store / In-App Purchase for iOS subscriptions when you purchase in the iOS app
              </li>
              <li>
                <strong>Supabase</strong> — database hosting (including Family Map location records you
                choose to share)
              </li>
              <li>
                <strong>Vercel</strong> — application hosting and analytics
              </li>
              <li>
                <strong>OpenStreetMap / CARTO</strong> — map tiles for KINZO AI display;
                <strong> Esri</strong> — optional satellite imagery
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
              . Deleting your account removes associated MyMotiveFamily household membership and
              location records tied to that account, subject to legal retention needs. You may also
              email{" "}
              <a href={`mailto:${LEGAL_CONTACT.privacy}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>
              .
            </p>
          </section>

          <section id="canada">
            <h2 className="text-lg font-semibold text-forward-900">7. Your rights (Canada — PIPEDA)</h2>
            <p className="mt-2 text-sm leading-relaxed">
              You may request access to, correction of, or deletion of your personal information, subject
              to legal exceptions. You may withdraw consent for optional processing (such as marketing,
              analytics where applicable, calendar connection, Family location sharing, or AI) where
              applicable. Contact us at{" "}
              <a href={`mailto:${LEGAL_CONTACT.privacy}`} className="text-brand-blue hover:underline">
                {LEGAL_CONTACT.privacy}
              </a>
              . You may file a complaint with the Office of the Privacy Commissioner of Canada if you
              believe your privacy rights have been violated.
            </p>
          </section>

          <section id="us">
            <h2 className="text-lg font-semibold text-forward-900">8. U.S. residents</h2>
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
            <h2 className="text-lg font-semibold text-forward-900">9. Marketing (CASL — Canada)</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We only send promotional emails if you opt in at registration or later. Every marketing
              email includes an unsubscribe link. Transactional emails (billing, security, service
              updates) may still be sent.
            </p>
          </section>

          <section id="children">
            <h2 className="text-lg font-semibold text-forward-900">10. Children</h2>
            <p className="mt-2 text-sm leading-relaxed">
              MotiveLife is not directed to children under 13 (U.S. COPPA). You must confirm you are at
              least 13 to register. We do not knowingly collect data from children under 13. Contact us
              to request deletion if you believe a child has registered. Household features that
              reference younger members must be used only with appropriate parental / guardian consent.
            </p>
          </section>

          <section id="retention">
            <h2 className="text-lg font-semibold text-forward-900">11. Retention &amp; security</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We retain account data while your account is active and for a reasonable period afterward
              for legal, tax, and fraud-prevention purposes. Billing records may be retained as required
              by law. Family location: live pins update while you share; GPS breadcrumbs are kept about
              35 days (enough to redraw recent drive routes); finished drives and place stays are kept
              about 90 days on free live map, or about 12 months with MyMotiveFamily, then removed
              automatically. You can clear your own cloud history anytime in Family Map. Data is also
              removed or dissociated when you leave the household or delete your account (subject to
              short-term backups and legal holds). We use encryption in transit, hashed passwords, and
              access controls — no system is 100% secure.
            </p>
          </section>

          <section id="subscription">
            <h2 className="text-lg font-semibold text-forward-900">12. Subscriptions</h2>
            <p className="mt-2 text-sm leading-relaxed">{SUBSCRIPTION_DISCLOSURE}</p>
          </section>

          <section id="changes">
            <h2 className="text-lg font-semibold text-forward-900">13. Changes</h2>
            <p className="mt-2 text-sm leading-relaxed">
              We may update this policy. Material changes will be posted here with a new version date.
              Continued use after changes constitutes acceptance where permitted by law.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-lg font-semibold text-forward-900">14. Contact</h2>
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
