import { HOW_IT_WORKS } from "@/lib/marketing";

export function LandingHowItWorks() {
  return (
    <section className="bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-blue">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
            From overwhelmed to on track in three steps
          </h2>
          <p className="mt-4 text-lg text-forward-600">
            MotiveLife isn&apos;t another chatbot. It&apos;s a daily operating system for your
            life — built around action, memory, and momentum.
          </p>
        </div>

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className="relative">
              <span className="text-5xl font-bold leading-none brand-gradient-text opacity-30">
                {item.step}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-forward-900">{item.title}</h3>
              <p className="mt-3 text-forward-600 leading-relaxed">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
