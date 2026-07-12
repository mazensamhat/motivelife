import Image from "next/image";
import Link from "next/link";
import { CORP_LOGO, PLATFORMS } from "@/lib/platforms";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(232,197,71,0.16),transparent_55%)]" />
        <div className="noise absolute inset-0 opacity-40" />
        <div className="horizon-glow absolute inset-x-0 bottom-[14%] mx-auto h-24 w-[70%] rounded-full bg-gold/25" />
        <div className="absolute inset-x-0 bottom-[18%] h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-16 pt-4 text-center sm:px-8">
        <h1 className="sr-only">Motive-Corp</h1>

        <div className="animate-rise relative w-full max-w-md sm:max-w-lg">
          <div className="gold-flare absolute inset-[12%] rounded-full bg-gold/25 blur-3xl" />
          <Image
            src={CORP_LOGO}
            alt="Motive-Corp — Innovate, Connect, Empower"
            width={1024}
            height={1024}
            className="relative mx-auto h-auto w-full object-contain drop-shadow-[0_0_40px_rgba(232,197,71,0.25)]"
            priority
          />
        </div>

        <p className="animate-rise-delay-1 mt-2 font-[family-name:var(--font-display)] text-[11px] font-semibold tracking-[0.35em] text-gold uppercase sm:text-xs">
          Innovate · Connect · Empower
        </p>

        <p className="animate-rise-delay-2 mt-4 max-w-2xl text-base leading-relaxed text-mist sm:text-lg">
          Route to the right Motive — life, automotive intelligence, trades, or
          local business growth.
        </p>

        <div className="animate-rise-delay-3 mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/#match"
            data-track="hero_find_fit"
            className="rounded-full bg-gold px-7 py-3.5 text-sm font-bold tracking-wide text-void transition hover:bg-gold-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            Find your fit
          </Link>
          <Link
            href="/platforms"
            data-track="hero_explore_platforms"
            className="rounded-full border border-snow/25 px-7 py-3.5 text-sm font-semibold tracking-wide text-snow transition hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            Explore platforms
          </Link>
        </div>

        <nav
          aria-label="Platform paths"
          className="animate-rise-delay-3 mt-8 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-xs tracking-wide text-mist/80 sm:gap-x-2 sm:text-sm"
        >
          {PLATFORMS.map((p, i) => (
            <span key={p.id} className="inline-flex items-center">
              {i > 0 ? (
                <span className="mx-2 text-gold/35" aria-hidden>
                  ·
                </span>
              ) : null}
              <Link
                href={`/#${p.slug}`}
                className="transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              >
                {p.lane}
              </Link>
            </span>
          ))}
        </nav>
      </div>
    </section>
  );
}
