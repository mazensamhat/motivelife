import { Check, X } from "lucide-react";
import { COMPARISON_ROWS } from "@/lib/marketing-copy";

export function LandingComparison() {
  return (
    <section id="compare" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-blue">
            Why MotiveLife
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
            Not just another chatbot
          </h2>
          <p className="mt-4 text-lg text-forward-600">
            ChatGPT answers questions. MotiveLife runs your life — memory, planning, voice, and
            progress in one place.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-forward-200 shadow-sm">
          <div className="grid grid-cols-2 border-b border-forward-200 bg-forward-50 text-sm font-semibold">
            <div className="px-4 py-4 text-forward-500 sm:px-6">Generic AI chat</div>
            <div className="border-l border-forward-200 bg-brand-blue/5 px-4 py-4 text-brand-blue sm:px-6">
              MotiveLife
            </div>
          </div>

          <ul>
            {COMPARISON_ROWS.map((row, index) => (
              <li
                key={row.generic}
                className={`grid grid-cols-2 text-sm ${
                  index < COMPARISON_ROWS.length - 1 ? "border-b border-forward-100" : ""
                }`}
              >
                <div className="flex items-start gap-2.5 px-4 py-4 text-forward-600 sm:px-6">
                  <X
                    className="mt-0.5 h-4 w-4 shrink-0 text-forward-300"
                    aria-hidden
                  />
                  <span>{row.generic}</span>
                </div>
                <div className="flex items-start gap-2.5 border-l border-forward-100 bg-brand-blue/[0.03] px-4 py-4 font-medium text-forward-900 sm:px-6">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-green"
                    aria-hidden
                  />
                  <span>{row.motivelife}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
