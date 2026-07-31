import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "Motive-Corp builds AI platforms that help people and businesses make better decisions.",
};

export default function AboutPage() {
  return (
    <div className="pt-16">
      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <Image
          src="/brand/motive-corp-logo.png"
          alt="Motive-Corp official logo"
          width={480}
          height={480}
          className="mx-auto h-auto w-full max-w-[280px] object-contain"
          priority
        />
        <p className="mt-8 text-center text-xs font-semibold tracking-[0.3em] text-gold uppercase">
          About Motive-Corp
        </p>
        <h1 className="mt-4 text-center font-[family-name:var(--font-display)] text-4xl font-bold sm:text-5xl">
          Innovate. Connect. Empower.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-mist">
          Motive-Corp is the parent behind four focused AI platforms. We build
          tools that turn insight into action — for personal growth, markets,
          local business reputation, and one secret project still to come.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-mist">
          Each product keeps its own brand, domain, and conversion path. The
          Motive family shares a standard: clear outcomes, privacy-minded
          design, and software that earns a subscription.
        </p>

        <div className="relative mt-12 overflow-hidden rounded-3xl border border-line/50">
          <Image
            src="/brand/motive-corp-family.png"
            alt="Motive-Corp and its four platforms"
            width={1200}
            height={800}
            className="h-auto w-full"
          />
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Innovate",
              body: "Ship AI products that solve one job exceptionally well.",
            },
            {
              title: "Connect",
              body: "Link people, markets, and businesses to clearer decisions.",
            },
            {
              title: "Empower",
              body: "Give operators and individuals leverage without complexity.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-panel p-5">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-gold">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-mist">{item.body}</p>
            </div>
          ))}
        </div>

        <Link
          href="/platforms"
          className="mt-12 inline-flex rounded-full bg-gold px-7 py-3.5 text-sm font-bold text-void"
        >
          Explore platforms
        </Link>
      </section>
    </div>
  );
}
