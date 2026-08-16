"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductSuiteIcon } from "@/components/product-icons";
import {
  MARKETING_SUITE_PRODUCTS,
  PRODUCT_SUITE,
} from "@/lib/product-suite";

/**
 * MotiveLife product suite — DayO, LifeVue, KINZO, UPLIFT, Kashu, VYRA.
 * Parent brand stays MotiveLife; these are the named products in the suite.
 */
export function LandingSuiteProducts() {
  return (
    <section
      id="products"
      className="scroll-mt-24 border-b border-forward-200 bg-gradient-to-b from-forward-950 via-forward-900 to-forward-950 py-16 text-white sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
          MotiveLife suite
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          Six products. One life operating system.
        </h2>
        <p className="mt-5 max-w-2xl text-base text-forward-300 sm:text-lg">
          DayO runs your day. LifeVue sees your life. KINZO watches your family.
          UPLIFT lifts your goals. Kashu protects your cash flow. VYRA is your AI Chief of Staff.
        </p>
        <p className="mt-4 text-sm text-forward-400">
          Prefer a sketch? Watch the{" "}
          <Link href="/videos" className="font-semibold text-brand-cyan hover:underline">
            pencil stories
          </Link>{" "}
          — ~45 seconds each, deep voice, no stock humans.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_SUITE_PRODUCTS.map((item) => {
            const product = PRODUCT_SUITE[item.id];
            return (
              <article
                key={item.id}
                className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                <Link href={item.href} className="flex flex-1 flex-col">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${product.primary} 22%, transparent)`,
                      boxShadow: `0 0 24px color-mix(in srgb, ${product.primary} 35%, transparent)`,
                    }}
                  >
                    <ProductSuiteIcon id={item.id} className="h-8 w-8" />
                  </div>
                  <p
                    className="mt-4 text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: product.primaryLight }}
                  >
                    {product.label}
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold text-white">
                    {product.tagline}
                  </p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-forward-400">
                    {item.blurb}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white/80 group-hover:text-white">
                    Explore
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
                <Link
                  href={`/videos#${item.id}`}
                  className="mt-3 text-xs font-medium text-forward-400 underline-offset-2 hover:text-white hover:underline"
                >
                  Watch pencil story
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
