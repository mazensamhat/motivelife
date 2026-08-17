"use client";

import Link from "next/link";
import { ProductSuiteIcon } from "@/components/product-icons";
import {
  MARKETING_SUITE_PRODUCTS,
  PRODUCT_SUITE,
  type ProductSuiteId,
} from "@/lib/product-suite";

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-blue">
            MotiveLife suite
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
            Named products for every part of your life
          </h2>
          <p className="mt-4 text-lg text-forward-600">
            Not generic AI advice. DayO, LifeVue, KINZO, UPLIFT, Kashu, Vitalu, and VYRA each have a job —
            together they run your life operating system.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_SUITE_PRODUCTS.map((item) => {
            const product = PRODUCT_SUITE[item.id];
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group rounded-2xl border border-forward-200 bg-forward-50/50 p-6 transition-all hover:border-brand-blue/30 hover:bg-white hover:shadow-md"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${product.primary} 18%, white)`,
                  }}
                >
                  <ProductSuiteIcon
                    id={item.id as ProductSuiteId}
                    className="h-7 w-7"
                  />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forward-900">
                  {product.label}
                </h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-forward-500">
                  {product.tagline}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-forward-600">
                  {item.blurb}
                </p>
              </Link>
            );
          })}
          <article className="rounded-2xl border border-forward-200 bg-forward-50/50 p-6">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${PRODUCT_SUITE.motiveiq.primary} 18%, white)`,
              }}
            >
              <ProductSuiteIcon id="motiveiq" className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-forward-900">
              {PRODUCT_SUITE.motiveiq.label}
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-forward-500">
              {PRODUCT_SUITE.motiveiq.tagline}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-forward-600">
              Patterns, memory, and insights that compound across every MotiveLife product.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
