"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ProductSuiteIcon } from "@/components/product-icons";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import {
  LIFE_OS_ORBIT,
  MARKETING_MODULE_COLOR,
  type MarketingModuleId,
} from "@/lib/marketing-palette";
import { cn } from "@/lib/utils";

const ORBIT_POSITIONS = [
  "top-[4%] left-1/2 -translate-x-1/2",
  "top-[22%] right-[2%]",
  "bottom-[22%] right-[2%]",
  "bottom-[4%] left-1/2 -translate-x-1/2",
  "bottom-[22%] left-[2%]",
  "top-[22%] left-[2%]",
] as const;

function moduleLabel(id: MarketingModuleId) {
  return PRODUCT_SUITE[id].label;
}

export function LandingLifeOsHub() {
  const [active, setActive] = useState<MarketingModuleId | "vyra">("vyra");

  const activeMeta =
    active === "vyra"
      ? {
          label: "VYRA",
          tagline: PRODUCT_SUITE.vyra.tagline,
          detail:
            "Your AI Chief of Staff. Ask once — get a plan that consults DayO, Kashu, Vitalu, KINZO, and UPLIFT.",
          href: "/#products",
          color: MARKETING_MODULE_COLOR.vyra,
        }
      : {
          label: moduleLabel(active),
          tagline: PRODUCT_SUITE[active].tagline,
          detail:
            active === "kashu"
              ? "$727 Safe to Spend — details one tap away."
              : active === "vitalu"
                ? "Vital Score 78 — calm health intelligence, not a calorie diary."
                : active === "dayo"
                  ? "4 priorities today — your day, briefed."
                  : active === "kinzo"
                    ? "Family good — live updates without hovering."
                    : active === "uplift"
                      ? "3 goals on track — missions linked to your week."
                      : "Life Momentum 84 — your life in one view.",
          href:
            active === "kashu"
              ? "/cash-flow"
              : active === "vitalu"
                ? "/wellness"
                : active === "kinzo"
                  ? "/family"
                  : active === "lifevue"
                    ? "/#dashboard"
                    : "/#products",
          color: MARKETING_MODULE_COLOR[active],
        };

  return (
    <section
      id="products"
      className="scroll-mt-24 border-y border-white/[0.06] bg-[#0D1420] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#98A5B7]">
          Your Life OS
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-[#F7F9FC] sm:text-5xl">
          Seven parts of one system.
        </h2>
        <p className="mt-4 max-w-xl text-base text-[#98A5B7] sm:text-lg">
          Tap a module. VYRA sits at the center — intelligence across your life, not another app icon.
        </p>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-[18%] rounded-full border border-white/[0.06]" aria-hidden />
            <div className="absolute inset-[32%] rounded-full border border-dashed border-white/[0.08]" aria-hidden />

            <button
              type="button"
              onClick={() => setActive("vyra")}
              className={cn(
                "absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full motion-interface focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]",
                active === "vyra" ? "vyra-orb vyra-orb-active scale-105" : "vyra-orb opacity-90 hover:scale-105",
              )}
              aria-pressed={active === "vyra"}
            >
              <span className="font-display text-sm font-bold text-white">VYRA</span>
              <span className="mt-0.5 text-[10px] text-white/80">Intelligence</span>
            </button>

            {LIFE_OS_ORBIT.map((node, i) => {
              const color = MARKETING_MODULE_COLOR[node.id];
              const isActive = active === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActive(node.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "absolute flex w-[30%] min-w-[7.5rem] flex-col items-center gap-1.5 rounded-2xl px-2 py-3 motion-interface focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]",
                    ORBIT_POSITIONS[i],
                    isActive ? "ml-glass scale-105" : "opacity-80 hover:opacity-100",
                  )}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
                  >
                    <ProductSuiteIcon id={node.id} className="h-6 w-6" color={color} />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-[#98A5B7]">
                    {node.domain}
                  </span>
                  <span className="font-display text-xs font-semibold" style={{ color }}>
                    {moduleLabel(node.id)}
                  </span>
                </button>
              );
            })}
          </div>

          <article className="ml-glass rounded-3xl p-8 motion-interface">
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: activeMeta.color }}
            >
              {activeMeta.label}
            </p>
            <h3 className="mt-3 font-display text-2xl font-semibold text-[#F7F9FC] sm:text-3xl">
              {activeMeta.tagline}
            </h3>
            <p className="mt-4 text-base leading-relaxed text-[#98A5B7]">{activeMeta.detail}</p>
            <Link
              href={activeMeta.href}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#F7F9FC] hover:underline"
            >
              Explore {activeMeta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
