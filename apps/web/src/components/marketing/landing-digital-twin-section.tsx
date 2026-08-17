import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TWIN_SIGNAL_CHAIN, TWIN_BUILD_STEPS } from "@/lib/marketing-copy";

export function LandingDigitalTwinSection() {
  return (
    <section
      id="digital-twin"
      className="scroll-mt-24 bg-[#070B14] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#98A5B7]">
          Digital Twin
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-[#F7F9FC] sm:text-5xl">
          MotiveLife learns how your life works.
        </h2>
        <p className="mt-4 max-w-xl text-base text-[#98A5B7] sm:text-lg">
          Not another profile — a living model that connects calendar, money, health, goals, and
          movement so tomorrow&apos;s guidance gets sharper every day.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          {TWIN_SIGNAL_CHAIN.map((item, i) => (
            <div key={item} className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold sm:text-sm ${
                  item === "MotiveLife AI"
                    ? "border-[#00E5FF]/40 bg-[#121C2B] text-[#F7F9FC]"
                    : "border-white/10 bg-[#0D1420] text-[#98A5B7]"
                }`}
              >
                {item}
              </span>
              {i < TWIN_SIGNAL_CHAIN.length - 1 ? (
                <span className="text-[#98A5B7]/40" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TWIN_BUILD_STEPS.map((s) => (
            <div key={s.step} className="ml-glass rounded-2xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#98A5B7]">
                Step {s.step}
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-[#F7F9FC]">{s.title}</p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums text-[#00E5FF]">
                {s.accuracy}%
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#98A5B7]">
                Prediction accuracy
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#98A5B7]">{s.detail}</p>
            </div>
          ))}
        </div>

        <p className="mt-10">
          <Link
            href="/blog/what-is-a-digital-twin-for-your-life"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#67E8F9] hover:underline"
          >
            What is a Digital Twin for your life?
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      </div>
    </section>
  );
}
