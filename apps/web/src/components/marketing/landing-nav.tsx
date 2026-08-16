"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { buttonClassName } from "@/components/button";
import { HERO_CTA } from "@/lib/marketing-copy";
import { PRODUCT_SUITE } from "@/lib/product-suite";

/** MotiveLife parent + named suite products. */
const LINKS = [
  { href: "/#products", label: PRODUCT_SUITE.dayo.shortLabel },
  { href: "/#products", label: PRODUCT_SUITE.lifevue.shortLabel },
  { href: "/family", label: PRODUCT_SUITE.kinzo.shortLabel },
  { href: "/#products", label: PRODUCT_SUITE.uplift.shortLabel },
  { href: "/#products", label: PRODUCT_SUITE.kashu.shortLabel },
  { href: "/#products", label: PRODUCT_SUITE.vyra.shortLabel },
  { href: "/#pricing", label: "Pricing" },
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-forward-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <BrandLogo href="/" size="md" className="shrink-0" variant="dark" />

        <nav className="hidden items-center gap-4 xl:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="text-sm font-medium text-forward-300 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className={buttonClassName({
              variant: "ghost",
              className: "hidden text-forward-200 hover:bg-white/10 hover:text-white sm:inline-flex",
            })}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={buttonClassName({
              size: "sm",
              className: "sm:px-5 sm:py-2.5 sm:text-sm",
            })}
          >
            {HERO_CTA}
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-white xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-white/10 bg-forward-950 px-4 py-4 xl:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link
                key={`m-${link.href}-${link.label}`}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-forward-200 hover:bg-white/5 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-forward-400"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
