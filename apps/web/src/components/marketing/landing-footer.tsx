import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  APP_STORE_CTA,
  CATEGORY_NAME,
  PLAN_PRICE_CAD,
  PLAY_STORE_CTA,
  TRIAL_DAYS,
} from "@/lib/marketing";
import { getSocialPlatforms } from "@/lib/marketing-channels";
import {
  APP_STORE_URL,
  MOTIVE_CORP_NAME,
  MOTIVE_CORP_SITE,
  MOTIVE_FAMILY_BRANDS,
  PLAY_STORE_URL,
} from "@/lib/motive-family";

export function LandingFooter() {
  const socialProfiles = getSocialPlatforms().filter((p) => p.profileUrl);

  return (
    <footer className="border-t border-forward-200 bg-forward-950 text-forward-300">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <BrandLogo href="/" size="md" className="shrink-0" variant="dark" />
            <p className="mt-3 text-sm text-forward-500">
              {CATEGORY_NAME}. One AI for your calendar, money, health, goals, and habits — private
              to you.
            </p>
            <p className="mt-4 text-sm text-forward-400">
              Part of the{" "}
              <a
                href={MOTIVE_CORP_SITE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-forward-200 underline-offset-2 hover:text-white hover:underline"
              >
                {MOTIVE_CORP_NAME}
              </a>{" "}
              group.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-forward-950 transition hover:bg-forward-100"
              >
                {APP_STORE_CTA}
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                {PLAY_STORE_CTA}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="#predictions" className="hover:text-white">
                    Predictions
                  </Link>
                </li>
                <li>
                  <Link href="#life-feed" className="hover:text-white">
                    Life Feed
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-white">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    App Store
                  </a>
                </li>
                <li>
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    Google Play
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
                Motive-Corp
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href={MOTIVE_CORP_SITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    Motive-Corp
                  </a>
                </li>
                {MOTIVE_FAMILY_BRANDS.map((brand) => (
                  <li key={brand.id}>
                    <a
                      href={brand.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white"
                      title={brand.tagline}
                    >
                      {brand.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
                Account
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/register" className="hover:text-white">
                    Start free trial
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="hover:text-white">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
                Legal
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/privacy" className="hover:text-white">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/data-deletion" className="hover:text-white">
                    Data deletion
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-forward-500">
          <p>
            © {new Date().getFullYear()} MotiveLife · A {MOTIVE_CORP_NAME} company · {TRIAL_DAYS}
            -day free trial, then {PLAN_PRICE_CAD}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-forward-600">
            <a
              href={MOTIVE_CORP_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-forward-300"
            >
              {MOTIVE_CORP_NAME}
            </a>
            {MOTIVE_FAMILY_BRANDS.map((brand) => (
              <a
                key={brand.id}
                href={brand.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-forward-300"
              >
                {brand.name}
              </a>
            ))}
            {socialProfiles.map((platform) => (
              <a
                key={platform.id}
                href={platform.profileUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-forward-300"
              >
                {platform.label}
              </a>
            ))}
          </p>
          <p className="mt-4 text-[9px] leading-snug text-forward-700/80">
            Testimonials are representative launch stories; verified quotes will replace these over
            time.
          </p>
        </div>
      </div>
    </footer>
  );
}
