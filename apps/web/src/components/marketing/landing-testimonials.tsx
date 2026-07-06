import { TESTIMONIALS } from "@/lib/marketing-copy";
import { Star } from "lucide-react";

export function LandingTestimonials() {
  return (
    <section id="reviews" className="border-b border-forward-200 bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">People worldwide</p>
        <h2 className="mt-3 text-3xl font-semibold text-forward-900 sm:text-4xl">
          Trusted by people running complex lives
        </h2>
        <div className="mt-4 flex items-center justify-center gap-1 text-brand-blue">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-current" aria-hidden />
          ))}
          <span className="ml-2 text-sm font-medium text-forward-600">4.9 / 5 early user sentiment</span>
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="flex flex-col rounded-2xl border border-forward-200 bg-white p-5 shadow-sm"
          >
            <blockquote className="flex-1 text-sm leading-relaxed text-forward-700">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-4 border-t border-forward-100 pt-4">
              <p className="font-semibold text-forward-900">{t.name}</p>
              <p className="text-xs text-forward-500">
                {t.role} · {t.location}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-xl px-4 text-center text-xs text-forward-400">
        Representative early-user stories for launch. We&apos;ll replace these with verified testimonials as
        our community grows.
      </p>
    </section>
  );
}
