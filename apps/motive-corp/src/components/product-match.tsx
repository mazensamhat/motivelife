"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { OutboundLink } from "@/components/outbound-link";
import { trackCta } from "@/lib/analytics";
import {
  buildPlatformUrl,
  isMotiveIq,
  PLATFORMS,
  type PlatformId,
} from "@/lib/platforms";

const QUESTIONS: { id: PlatformId; label: string; hint: string }[] = [
  {
    id: "motivelife",
    label: "My life — career, money, health, habits",
    hint: "Personal operating system",
  },
  {
    id: "motiveiq",
    label: "Secret project",
    hint: "",
  },
  {
    id: "motivefx",
    label: "My trading — markets, crypto, signals",
    hint: "Market command center",
  },
  {
    id: "motivepulse",
    label: "My business — reviews, reputation, growth",
    hint: "Local growth automation",
  },
];

export function ProductMatch() {
  const [selected, setSelected] = useState<PlatformId | null>(null);
  const platform = PLATFORMS.find((p) => p.id === selected);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!platform) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [platform]);

  return (
    <section id="match" className="scroll-mt-24 border-t border-line/40 bg-ink py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <p className="text-center text-xs font-semibold tracking-[0.28em] text-gold uppercase">
          30-second match
        </p>
        <h2 className="mt-3 text-center font-[family-name:var(--font-display)] text-3xl font-bold sm:text-4xl">
          What are you optimizing?
        </h2>
        <p className="mt-3 text-center text-mist">
          Pick one. We&apos;ll send you straight to the right platform.
        </p>

        <div className="mt-10 grid gap-3" role="listbox" aria-label="Product match options">
          {QUESTIONS.map((q) => {
            const active = selected === q.id;
            const p = PLATFORMS.find((x) => x.id === q.id)!;
            return (
              <button
                key={q.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setSelected(q.id);
                  trackCta("product_match_select", { platform: q.id });
                }}
                className="rounded-2xl border px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-6"
                style={{
                  borderColor: active ? p.accent : "rgba(255,255,255,0.1)",
                  background: active ? p.accentSoft : "rgba(255,255,255,0.02)",
                }}
              >
                <span className="block text-sm font-semibold text-snow sm:text-base">
                  {q.label}
                </span>
                {q.hint ? (
                  <span className="mt-1 block text-xs text-mist">{q.hint}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {platform ? (
          <div
            ref={resultRef}
            className="mt-8 rounded-2xl border border-white/10 bg-black p-6 text-center sm:p-8"
            style={{
              boxShadow: `0 0 0 1px ${platform.accentSoft}, 0 16px 48px rgba(0,0,0,0.4)`,
            }}
          >
            {isMotiveIq(platform) ? (
              <>
                <div className="mx-auto flex justify-center">
                  <BrandLogo platform={platform} size="md" framed />
                </div>
                <p
                  className="mt-5 text-base font-medium tracking-wide"
                  style={{ color: platform.accent }}
                >
                  Secret project
                </p>
                <OutboundLink
                  href={buildPlatformUrl(platform, {
                    content: "product_match",
                    campaign: "router",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  trackEvent="outbound_platform_cta"
                  trackProps={{
                    platform: platform.id,
                    placement: "product_match",
                  }}
                  className="mt-4 inline-flex text-sm font-semibold tracking-[0.08em] text-mist/90 transition hover:text-snow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  style={{ ["--tw-ring-color" as string]: platform.accent }}
                >
                  Coming soon
                </OutboundLink>
              </>
            ) : (
              <>
                <p className="text-sm text-mist">Best fit</p>
                <div className="mx-auto mt-4 flex justify-center">
                  <BrandLogo platform={platform} size="md" framed />
                </div>
                <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-mist">
                  {platform.outcome}
                </p>
                <OutboundLink
                  href={buildPlatformUrl(platform, {
                    content: "product_match",
                    campaign: "router",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  trackEvent="outbound_platform_cta"
                  trackProps={{
                    platform: platform.id,
                    placement: "product_match",
                  }}
                  className="mt-6 inline-flex rounded-full px-8 py-3.5 text-sm font-bold text-void transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  style={{ background: platform.accent }}
                >
                  {platform.cta}
                </OutboundLink>
                <p className="mt-3 text-xs text-mist/70">
                  Opens {platform.siteUrl.replace(/^https?:\/\//, "")} in a new
                  tab
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
