import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { MotiveIqReveal } from "@/components/motive-iq-reveal";
import { OutboundLink } from "@/components/outbound-link";
import {
  buildPlatformUrl,
  getPlatform,
  isMotiveIq,
  PLATFORMS,
} from "@/lib/platforms";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PLATFORMS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const platform = getPlatform(slug);
  if (!platform) return {};
  return {
    title: platform.name,
    description: platform.description,
    openGraph: {
      images: [{ url: platform.logo }],
    },
  };
}

export default async function PlatformDetailPage({ params }: Props) {
  const { slug } = await params;
  const platform = getPlatform(slug);
  if (!platform) notFound();

  if (isMotiveIq(platform)) {
    return (
      <div className="pt-16">
        <MotiveIqReveal index={0} />
        <section className="border-t border-line/30 px-5 py-12 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-mist">
              <Link
                href="/platforms"
                className="text-sm transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              >
                ← All platforms
              </Link>
            </p>
          </div>
        </section>
      </div>
    );
  }

  const ctaUrl = buildPlatformUrl(platform, {
    content: `bridge_${platform.id}`,
    campaign: "bridge",
  });

  const bullets = [
    { label: "Problem", body: platform.problem },
    { label: "Outcome", body: platform.outcome },
    { label: "For whom", body: platform.forWhom },
  ];

  return (
    <div className="pt-16">
      <section
        className="relative overflow-hidden px-5 py-14 sm:px-8 sm:py-20"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${platform.accentSoft}, transparent 55%), #050505`,
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row">
          <div className="relative flex flex-1 justify-center">
            <BrandLogo platform={platform} size="lg" framed priority />
          </div>

          <div className="flex-1 text-center lg:text-left">
            <p
              className="text-xs font-semibold tracking-[0.28em] uppercase"
              style={{ color: platform.accent }}
            >
              Part of Motive-Corp
            </p>
            <h1 className="sr-only">{platform.name}</h1>
            <p className="mt-5 mx-auto max-w-xl text-base leading-relaxed text-mist sm:text-lg lg:mx-0">
              {platform.description}
            </p>

            <ul className="mx-auto mt-8 max-w-xl space-y-4 text-left lg:mx-0">
              {bullets.map((b) => (
                <li
                  key={b.label}
                  className="border-l-2 pl-4"
                  style={{ borderColor: platform.accent }}
                >
                  <p className="text-xs font-semibold tracking-[0.2em] text-gold-dim uppercase">
                    {b.label}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-mist sm:text-base">
                    {b.body}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <OutboundLink
                href={ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                trackEvent="outbound_platform_cta"
                trackProps={{ platform: platform.id, placement: "bridge" }}
                className="rounded-full px-7 py-3.5 text-sm font-bold text-void transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                style={{ background: platform.accent }}
              >
                {platform.cta}
              </OutboundLink>
              <Link
                href="/#match"
                className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold transition hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              >
                Not sure? Find your fit
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line/30 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            Ready when you are
          </h2>
          <p className="mt-3 text-mist">
            You&apos;ll continue on {platform.siteUrl.replace(/^https?:\/\//, "")}{" "}
            — that&apos;s where trials and subscriptions live.
          </p>
          <OutboundLink
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            trackEvent="outbound_platform_cta"
            trackProps={{ platform: platform.id, placement: "bridge_footer" }}
            className="mt-8 inline-flex rounded-full px-8 py-3.5 text-sm font-bold text-void transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            style={{ background: platform.accent }}
          >
            Continue to {platform.shortName}
          </OutboundLink>
          <p className="mt-6">
            <Link
              href="/platforms"
              className="text-sm text-mist transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            >
              ← All platforms
            </Link>
          </p>
        </div>
      </section>

      <div className="sticky bottom-0 z-40 border-t border-line/40 bg-void/95 p-3 backdrop-blur-xl sm:hidden">
        <OutboundLink
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          trackEvent="outbound_platform_cta"
          trackProps={{ platform: platform.id, placement: "bridge_sticky" }}
          className="flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-bold text-void focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          style={{ background: platform.accent }}
        >
          {platform.cta}
        </OutboundLink>
      </div>
    </div>
  );
}
