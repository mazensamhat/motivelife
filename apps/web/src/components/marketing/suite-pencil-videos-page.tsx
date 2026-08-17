import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { buttonClassName } from "@/components/button";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { ModulePencilVideoPlayer } from "@/components/marketing/module-pencil-video-player";
import { MODULE_PENCIL_VIDEOS } from "@/lib/module-pencil-videos";
import { PRODUCT_SUITE } from "@/lib/product-suite";

/**
 * Suite product overview videos — customer-facing gallery.
 */
export function SuitePencilVideosPage() {
  const featured = MODULE_PENCIL_VIDEOS.find((v) => v.id === "kashu") ?? MODULE_PENCIL_VIDEOS[0];

  return (
    <div className="min-h-screen bg-[#f3f5f4] text-[#1a2226]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#14201f]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo href="/" size="md" className="shrink-0" variant="dark" />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Suite videos">
            <Link href="/#products" className="text-sm font-medium text-white/75 transition hover:text-white">
              Suite
            </Link>
            <Link href="/videos" className="text-sm font-semibold text-white">
              Videos
            </Link>
            <Link href="/family" className="text-sm font-medium text-white/75 transition hover:text-white">
              KINZO
            </Link>
            <Link href="/cash-flow" className="text-sm font-medium text-white/75 transition hover:text-white">
              Kashu
            </Link>
          </nav>
          <Link
            href="/register"
            className={buttonClassName({
              size: "sm",
              className: "rounded-sm bg-[#5ba19b] px-5 text-[#14201f] hover:bg-[#7bc4bd] sm:px-5",
            })}
          >
            Get started
          </Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#14201f] text-white">
          <div
            className="pointer-events-none absolute -left-24 top-10 h-[28rem] w-[28rem] rounded-full bg-[#5ba19b]/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-16 bottom-0 h-[24rem] w-[24rem] rounded-full bg-[#2a6f6a]/30 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(91,161,155,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(91,161,155,0.35) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              maskImage: "radial-gradient(ellipse at 50% 35%, black 20%, transparent 75%)",
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7bc4bd]">
              MotiveLife suite
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              See how each product fits your life
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Short walkthroughs of DayO, LifeVue, KINZO, UPLIFT, Kashu, and VYRA — so you know
              what each piece does before you open the app.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#watch"
                className="rounded-sm bg-[#5ba19b] px-6 py-3 text-sm font-semibold text-[#14201f] transition hover:bg-[#7bc4bd]"
              >
                Watch overview
              </a>
              <a
                href="#modules"
                className="rounded-sm border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5"
              >
                Browse all videos
              </a>
            </div>
          </div>
        </section>

        <section id="watch" className="scroll-mt-24 bg-[#14201f] px-6 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7bc4bd]">
                Featured
              </p>
              <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-5xl">
                How Kashu protects cash flow
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
                Safe to Spend after obligations and your safety floor — statement upload or manual
                entry, no bank connect required.
              </p>
            </div>
            <div className="relative mt-10 overflow-hidden rounded-sm bg-black ring-1 ring-white/10">
              <ModulePencilVideoPlayer video={featured} paper={false} className="rounded-none border-0" />
            </div>
          </div>
        </section>

        <section className="bg-[#f3f5f4] px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a6f6a]">
                The suite
              </p>
              <h2 className="mt-4 font-display text-3xl tracking-tight text-[#1a2226] sm:text-5xl">
                Six products. One operating system.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#5a6568] sm:text-lg">
                Your day, your life view, your family, your goals, your cash flow, and your AI
                chief of staff — connected.
              </p>
            </div>
            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {[
                {
                  n: "01",
                  title: "For you",
                  body: "DayO, LifeVue, UPLIFT, Kashu, and VYRA keep your personal life clear and moving.",
                },
                {
                  n: "02",
                  title: "For family",
                  body: "KINZO watches the household in motion — location, routines, and calm alerts.",
                },
                {
                  n: "03",
                  title: "One login",
                  body: "Start on MyMotiveLife.com — the suite is built to work together.",
                },
              ].map((step) => (
                <div key={step.n} className="relative pt-2">
                  <span className="font-display text-5xl text-[#5ba19b]/35">{step.n}</span>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#1a2226]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#5a6568] sm:text-base">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="modules" className="scroll-mt-24 bg-[#14201f] px-6 py-20 text-white sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7bc4bd]">
                Product videos
              </p>
              <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-5xl">
                Pick a product. Watch the story.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
                Then open it in the app when you’re ready.
              </p>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-4 gap-y-3">
              {MODULE_PENCIL_VIDEOS.map((v) => (
                <a
                  key={v.id}
                  href={`#${v.id}`}
                  className="border-b border-[#5ba19b]/40 pb-1 text-sm font-medium text-white/80 transition hover:text-white sm:text-base"
                >
                  {v.label}
                </a>
              ))}
            </div>

            <div className="mt-16 space-y-20">
              {MODULE_PENCIL_VIDEOS.map((video) => {
                const product = PRODUCT_SUITE[video.id];
                return (
                  <article
                    key={video.id}
                    id={video.id}
                    className="scroll-mt-28 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center"
                  >
                    <div className="overflow-hidden rounded-sm ring-1 ring-white/10">
                      <ModulePencilVideoPlayer video={video} paper={false} className="rounded-none border-0" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7bc4bd]">
                        {product.label}
                      </p>
                      <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                        {video.tagline}
                      </h3>
                      <p className="mt-4 text-base leading-relaxed text-white/70">{video.blurb}</p>
                      <Link
                        href={video.href}
                        className="mt-6 inline-flex text-sm font-semibold text-[#7bc4bd] transition hover:text-white"
                      >
                        Open {product.label} →
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#eef1f2] px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a6f6a]">
              Next step
            </p>
            <h2 className="mt-4 font-display text-3xl tracking-tight text-[#1a2226] sm:text-5xl">
              Build your Digital Twin
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#5a6568] sm:text-lg">
              DayO, LifeVue, KINZO, UPLIFT, Kashu, and VYRA — one suite for the life you’re
              running.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex rounded-sm bg-[#14201f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1c2c2a]"
            >
              Start free trial
            </Link>
          </div>
        </section>
      </main>

      <div className="bg-[#14201f] text-white">
        <LandingFooter />
      </div>
    </div>
  );
}
