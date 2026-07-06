import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CATEGORY_NAME, PLAN_PRICE_CAD, TRIAL_DAYS } from "@/lib/marketing";
import { getSocialPlatforms } from "@/lib/marketing-channels";

export function LandingFooter() {
  const socialProfiles = getSocialPlatforms().filter((p) => p.profileUrl);

  return (
    <footer className="border-t border-forward-200 bg-forward-950 text-forward-300">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo href="/" size="md" className="shrink-0" variant="dark" />
            <p className="mt-3 max-w-xs text-sm text-forward-500">
              {CATEGORY_NAME}. One AI for your calendar, money, health, goals, and habits — private
              to you.
            </p>
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
              </ul>
            </div>
            {socialProfiles.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
                  Follow
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {socialProfiles.map((platform) => (
                    <li key={platform.id}>
                      <a
                        href={platform.profileUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white"
                      >
                        {platform.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-forward-500">
          <p>
            © {new Date().getFullYear()} MotiveLife · {TRIAL_DAYS}-day free trial, then{" "}
            {PLAN_PRICE_CAD}
          </p>
          <p className="mt-4 text-[9px] leading-snug text-forward-700/80">
            Testimonials are representative launch stories; verified quotes will replace these over time.
          </p>
        </div>
      </div>
    </footer>
  );
}
