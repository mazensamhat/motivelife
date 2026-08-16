import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { buttonClassName } from "@/components/button";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { ModulePencilVideoPlayer } from "@/components/marketing/module-pencil-video-player";
import { MODULE_PENCIL_VIDEOS } from "@/lib/module-pencil-videos";
import { PRODUCT_SUITE } from "@/lib/product-suite";

/**
 * Suite pencil stories — graphite-on-paper videos with deep narration.
 */
export function SuitePencilVideosPage() {
  return (
    <div className="min-h-screen bg-[#f3eee4] text-[#2a2a2c]">
      <header className="sticky top-0 z-50 border-b border-[#d9d0c0]/80 bg-[#f3eee4]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
          <BrandLogo href="/" size="md" className="shrink-0" />
          <nav className="hidden items-center gap-5 sm:flex" aria-label="Pencil videos">
            <Link href="/" className="text-sm text-[#5a5852] hover:text-[#2a2a2c]">
              MotiveLife
            </Link>
            <Link href="/videos" className="text-sm font-semibold text-[#2a2a2c]">
              Pencil stories
            </Link>
            <Link href="/family" className="text-sm text-[#5a5852] hover:text-[#2a2a2c]">
              KINZO
            </Link>
            <Link href="/cash-flow" className="text-sm text-[#5a5852] hover:text-[#2a2a2c]">
              Kashu
            </Link>
          </nav>
          <Link href="/register" className={buttonClassName({ size: "sm", className: "sm:px-5" })}>
            Get started
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#d9d0c0]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 10%, rgba(0,0,0,0.06), transparent 45%), radial-gradient(circle at 80% 0%, rgba(0,0,0,0.04), transparent 40%)",
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6b6860]">
              MotiveLife suite · pencil stories
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
              Six modules. Drawn by hand. Told in a deep voice.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#5a5852]">
              No stock humans. No glossy CGI. Each ~45-second film is graphite on paper —
              DayO, LifeVue, KINZO, UPLIFT, Kashu, and VYRA — so the suite feels human before
              you ever open the app.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={buttonClassName({ size: "lg" })}>
                Build your Digital Twin
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/#products"
                className={buttonClassName({
                  size: "lg",
                  variant: "secondary",
                  className: "border-[#cfc6b6] bg-white/50 text-[#2a2a2c] hover:bg-white",
                })}
              >
                Explore the suite
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:py-20">
          {MODULE_PENCIL_VIDEOS.map((video) => {
            const product = PRODUCT_SUITE[video.id];
            return (
              <article
                key={video.id}
                id={video.id}
                className="scroll-mt-28 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center"
              >
                <ModulePencilVideoPlayer video={video} />
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.2em]"
                    style={{ color: product.primaryDark }}
                  >
                    {product.label}
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    {video.tagline}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-[#5a5852]">{video.blurb}</p>
                  <p className="mt-2 text-sm text-[#8a857a]">{video.durationLabel} · pencil · deep narration</p>
                  <Link
                    href={video.href}
                    className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#2a2a2c] underline-offset-4 hover:underline"
                  >
                    Open {product.label}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <div className="bg-forward-950 text-white">
        <LandingFooter />
      </div>
    </div>
  );
}
