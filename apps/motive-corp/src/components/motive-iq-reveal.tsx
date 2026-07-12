"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { OutboundLink } from "@/components/outbound-link";
import {
  buildPlatformUrl,
  getPlatform,
} from "@/lib/platforms";

export function MotiveIqReveal({ index = 1 }: { index?: number }) {
  const platform = getPlatform("motiveiq")!;
  const reverse = index % 2 === 1;
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOpen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.28, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gateUrl = buildPlatformUrl(platform, {
    content: "home_lane_motiveiq",
  });

  return (
    <section
      ref={sectionRef}
      id="motiveiq"
      className="relative scroll-mt-24 border-t border-white/5"
      style={{
        background: `linear-gradient(${reverse ? "270deg" : "90deg"}, ${platform.accentSoft} 0%, transparent 55%), #08080a`,
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-14 text-center sm:px-8 sm:py-20">
        <h2 className="sr-only">{platform.name}</h2>

        <div className="page-turn-stage relative mx-auto w-full max-w-md">
          <div
            className="pointer-events-none absolute inset-[12%] rounded-full opacity-50 blur-3xl"
            style={{ background: platform.accentSoft }}
            aria-hidden
          />

          <div
            className={`page-turn-leaf relative mx-auto ${open ? "is-open" : ""} ${
              reverse ? "page-turn-from-right" : "page-turn-from-left"
            }`}
          >
            <div className="page-turn-sheet relative overflow-hidden rounded-2xl border border-white/10 bg-black p-6 sm:rounded-3xl sm:p-8">
              <div
                className={`page-turn-spine absolute inset-y-0 w-px opacity-40 ${
                  reverse ? "right-0" : "left-0"
                }`}
                style={{
                  background: `linear-gradient(180deg, transparent, ${platform.accent}, transparent)`,
                }}
                aria-hidden
              />
              <OutboundLink
                href={gateUrl}
                target="_blank"
                rel="noopener noreferrer"
                trackEvent="outbound_platform_cta"
                trackProps={{ platform: "motiveiq", placement: "home_reveal_logo" }}
                className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ ["--tw-ring-color" as string]: platform.accent }}
                aria-label={`${platform.name} — ${platform.tagline}`}
              >
                <BrandLogo platform={platform} size="lg" framed priority={index === 0} />
              </OutboundLink>
            </div>
          </div>
        </div>

        <p
          className={`mt-8 text-base font-medium tracking-wide sm:text-lg ${
            open ? "animate-rise" : "opacity-0"
          }`}
          style={{ color: platform.accent }}
        >
          {platform.tagline}
        </p>

        <OutboundLink
          href={gateUrl}
          target="_blank"
          rel="noopener noreferrer"
          trackEvent="outbound_platform_cta"
          trackProps={{ platform: "motiveiq", placement: "home_reveal_soon" }}
          className={`mt-4 text-sm font-semibold tracking-[0.08em] text-mist/90 transition hover:text-snow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void ${
            open ? "animate-rise-delay-1" : "opacity-0"
          }`}
          style={{ ["--tw-ring-color" as string]: platform.accent }}
        >
          Coming soon
        </OutboundLink>
      </div>
    </section>
  );
}
