"use client";

import { useEffect, useState } from "react";
import { LIFE_PULSE_STORY } from "@/lib/marketing-copy";
import { MARKETING_MODULE_COLOR } from "@/lib/marketing-palette";
import { useInViewOnce } from "@/hooks/use-in-view-once";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

export function LandingLifePulseStory() {
  const { ref, inView } = useInViewOnce<HTMLElement>(0.25);
  const reduced = usePrefersReducedMotion();
  const [activeStep, setActiveStep] = useState(reduced ? LIFE_PULSE_STORY.steps.length - 1 : -1);

  useEffect(() => {
    if (!inView || reduced) {
      if (reduced) setActiveStep(LIFE_PULSE_STORY.steps.length - 1);
      return;
    }
    setActiveStep(-1);
    const timers = LIFE_PULSE_STORY.steps.map((_, i) =>
      window.setTimeout(() => setActiveStep(i), 600 + i * 900),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  return (
    <section
      ref={ref}
      id="connected-intelligence"
      className="scroll-mt-24 bg-[#070B14] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#98A5B7]">
          {LIFE_PULSE_STORY.eyebrow}
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[#F7F9FC] sm:text-5xl">
          {LIFE_PULSE_STORY.headline}
        </h2>
        <p className="mt-4 text-sm font-medium text-[#98A5B7]">{LIFE_PULSE_STORY.time}</p>

        <ol className="relative mt-12 space-y-0">
          {LIFE_PULSE_STORY.steps.map((step, i) => {
            const color = MARKETING_MODULE_COLOR[step.id];
            const isActive = i <= activeStep;
            const isVyra = step.id === "vyra";
            return (
              <li key={step.id} className="relative flex gap-4 pb-10 last:pb-0">
                {i < LIFE_PULSE_STORY.steps.length - 1 ? (
                  <svg
                    className="absolute left-[15px] top-10 h-[calc(100%-1.5rem)] w-4 overflow-visible"
                    aria-hidden
                  >
                    <line
                      x1="8"
                      y1="0"
                      x2="8"
                      y2="100%"
                      stroke={color}
                      strokeWidth="2"
                      strokeOpacity={isActive ? 0.55 : 0.15}
                      className={cn(
                        "life-pulse-path",
                        isActive && i < activeStep && !reduced && "is-running",
                      )}
                    />
                  </svg>
                ) : null}

                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 motion-interface",
                    isActive ? "border-transparent" : "border-white/15 bg-[#121C2B]",
                  )}
                  style={
                    isActive
                      ? {
                          background: `color-mix(in srgb, ${color} 25%, #121C2B)`,
                          borderColor: color,
                          boxShadow: isVyra ? `0 0 20px ${color}55` : undefined,
                        }
                      : undefined
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: isActive ? color : "#98A5B7" }}
                    aria-hidden
                  />
                </div>

                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-2xl px-4 py-4 motion-interface",
                    isVyra && isActive ? "ml-glass border border-[#A78BFA]/30" : "",
                    !isVyra && isActive ? "ml-glass" : "",
                    !isActive && "opacity-40",
                  )}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: isActive ? color : "#98A5B7" }}
                  >
                    {step.name}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold text-[#F7F9FC]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm text-[#98A5B7]">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
