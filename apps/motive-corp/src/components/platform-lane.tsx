import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { OutboundLink } from "@/components/outbound-link";
import { buildPlatformUrl, type Platform } from "@/lib/platforms";

export function PlatformLane({
  platform,
  index,
}: {
  platform: Platform;
  index: number;
}) {
  const reverse = index % 2 === 1;
  const ctaUrl = buildPlatformUrl(platform, {
    content: `home_lane_${platform.id}`,
  });

  return (
    <section
      id={platform.slug}
      className="relative scroll-mt-24 border-t border-white/5"
      style={{
        background: `linear-gradient(${reverse ? "270deg" : "90deg"}, ${platform.accentSoft} 0%, transparent 55%), #08080a`,
      }}
    >
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:gap-10 sm:px-8 sm:py-16 lg:items-center lg:gap-14 lg:py-20 ${
          reverse ? "lg:flex-row-reverse" : "lg:flex-row"
        }`}
      >
        <div className="relative flex flex-1 justify-center">
          <div
            className="absolute inset-[18%] rounded-full opacity-45 blur-3xl"
            style={{ background: platform.accentSoft }}
            aria-hidden
          />
          <BrandLogo
            platform={platform}
            size="lg"
            framed
            priority={index === 0}
            className="relative"
          />
        </div>

        <div className="flex-1 text-left">
          <p
            className="text-xs font-semibold tracking-[0.28em] uppercase"
            style={{ color: platform.accent }}
          >
            {platform.audience}
          </p>
          <h2 className="sr-only">{platform.name}</h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-mist sm:mt-5 sm:text-lg">
            {platform.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
            <OutboundLink
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              trackEvent="outbound_platform_cta"
              trackProps={{ platform: platform.id, placement: "home_lane" }}
              className="rounded-full px-6 py-3 text-sm font-bold tracking-wide text-void transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              style={{
                background: platform.accent,
              }}
            >
              {platform.cta}
            </OutboundLink>
            <Link
              href={`/platforms/${platform.slug}`}
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-snow transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              Learn more
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
