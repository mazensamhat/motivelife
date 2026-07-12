import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { OutboundLink } from "@/components/outbound-link";
import { ProductMatch } from "@/components/product-match";
import {
  buildPlatformUrl,
  isMotiveIq,
  PLATFORMS,
} from "@/lib/platforms";

export const metadata: Metadata = {
  title: "Platforms",
  description:
    "Explore Motive-Corp platforms: MotiveLife, MotiveIQ, MotiveFX, and MotivePulse IQ.",
};

export default function PlatformsPage() {
  return (
    <div className="pt-16">
      <section className="relative overflow-hidden border-b border-line/40 px-5 py-16 sm:px-8 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,197,71,0.12),transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">
            Four platforms
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-bold sm:text-6xl">
            Choose your Motive
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-mist">
            Compare audience, outcome, and next step — then continue on the
            product site where trials and demos live.
          </p>
        </div>
      </section>

      {/* Comparison table — desktop */}
      <section className="mx-auto hidden max-w-6xl px-5 py-12 sm:px-8 lg:block">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-ink/80 text-xs tracking-[0.18em] text-gold uppercase">
                <th className="px-5 py-4 font-semibold">Platform</th>
                <th className="px-5 py-4 font-semibold">Audience</th>
                <th className="px-5 py-4 font-semibold">Problem → outcome</th>
                <th className="px-5 py-4 font-semibold">Next step</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map((platform) => (
                <tr
                  key={platform.id}
                  className="border-b border-white/5 last:border-0"
                  style={{ background: "rgba(0,0,0,0.35)" }}
                >
                  <td className="px-5 py-5 align-middle">
                    <BrandLogo platform={platform} size="sm" framed />
                    <p className="sr-only">{platform.name}</p>
                  </td>
                  {isMotiveIq(platform) ? (
                    <>
                      <td
                        colSpan={2}
                        className="px-5 py-5 align-middle text-mist"
                        style={{ color: platform.accent }}
                      >
                        Automotive Intelligence
                      </td>
                      <td className="px-5 py-5 align-middle">
                        <OutboundLink
                          href={buildPlatformUrl(platform, {
                            content: `platforms_compare_${platform.id}`,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          trackEvent="outbound_platform_cta"
                          trackProps={{
                            platform: platform.id,
                            placement: "platforms_compare",
                          }}
                          className="text-sm font-semibold tracking-[0.08em] text-mist/90 transition hover:text-snow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                          style={{
                            ["--tw-ring-color" as string]: platform.accent,
                          }}
                        >
                          Coming soon
                        </OutboundLink>
                        <Link
                          href={`/platforms/${platform.slug}`}
                          className="mt-2 block text-xs text-mist transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                        >
                          Details →
                        </Link>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="max-w-[180px] px-5 py-5 align-middle text-mist">
                        {platform.audience}
                      </td>
                      <td className="max-w-sm px-5 py-5 align-middle">
                        <p className="text-mist/80">{platform.problem}</p>
                        <p className="mt-2 text-snow">{platform.outcome}</p>
                      </td>
                      <td className="px-5 py-5 align-middle">
                        <OutboundLink
                          href={buildPlatformUrl(platform, {
                            content: `platforms_compare_${platform.id}`,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          trackEvent="outbound_platform_cta"
                          trackProps={{
                            platform: platform.id,
                            placement: "platforms_compare",
                          }}
                          className="inline-flex rounded-full px-4 py-2 text-xs font-bold text-void transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                          style={{ background: platform.accent }}
                        >
                          {platform.cta}
                        </OutboundLink>
                        <Link
                          href={`/platforms/${platform.slug}`}
                          className="mt-2 block text-xs text-mist transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                        >
                          Details →
                        </Link>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Comparison cards — mobile / tablet */}
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:px-8 lg:hidden">
        {PLATFORMS.map((platform) =>
          isMotiveIq(platform) ? (
            <article
              key={platform.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black p-5 text-center"
              style={{ boxShadow: `0 0 0 1px ${platform.accentSoft}` }}
            >
              <div className="flex justify-center">
                <BrandLogo platform={platform} size="md" framed />
              </div>
              <p
                className="mt-5 text-base font-medium tracking-wide"
                style={{ color: platform.accent }}
              >
                Automotive Intelligence
              </p>
              <OutboundLink
                href={buildPlatformUrl(platform, {
                  content: `platforms_grid_${platform.id}`,
                })}
                target="_blank"
                rel="noopener noreferrer"
                trackEvent="outbound_platform_cta"
                trackProps={{
                  platform: platform.id,
                  placement: "platforms_grid",
                }}
                className="mt-4 inline-flex text-sm font-semibold tracking-[0.08em] text-mist/90 transition hover:text-snow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ ["--tw-ring-color" as string]: platform.accent }}
              >
                Coming soon
              </OutboundLink>
              <div className="mt-4">
                <Link
                  href={`/platforms/${platform.slug}`}
                  className="text-xs text-mist transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                >
                  Details →
                </Link>
              </div>
            </article>
          ) : (
            <article
              key={platform.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black p-5"
              style={{ boxShadow: `0 0 0 1px ${platform.accentSoft}` }}
            >
              <div className="flex justify-center">
                <BrandLogo platform={platform} size="md" framed />
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold tracking-[0.2em] text-gold-dim uppercase">
                    Audience
                  </dt>
                  <dd className="mt-1 text-mist">{platform.audience}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-[0.2em] text-gold-dim uppercase">
                    Problem
                  </dt>
                  <dd className="mt-1 text-mist">{platform.problem}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-[0.2em] text-gold-dim uppercase">
                    Outcome
                  </dt>
                  <dd className="mt-1 text-snow">{platform.outcome}</dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap gap-3">
                <OutboundLink
                  href={buildPlatformUrl(platform, {
                    content: `platforms_grid_${platform.id}`,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  trackEvent="outbound_platform_cta"
                  trackProps={{
                    platform: platform.id,
                    placement: "platforms_grid",
                  }}
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-void focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  style={{ background: platform.accent }}
                >
                  {platform.cta}
                </OutboundLink>
                <Link
                  href={`/platforms/${platform.slug}`}
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-snow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Details
                </Link>
              </div>
            </article>
          ),
        )}
      </section>

      <ProductMatch />
    </div>
  );
}
