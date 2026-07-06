import { LIFE_FEED_EXAMPLES } from "@/lib/marketing-copy";

export function LandingLifeFeed() {
  return (
    <section id="life-feed" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">Life Feed</p>
        <h2 className="mt-3 text-3xl font-semibold text-forward-900 sm:text-4xl">
          A feed — but every post is from your AI
        </h2>
        <p className="mt-4 text-lg text-forward-600">
          No scrolling strangers. Just what MotiveLife noticed about your life today.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-md px-4">
        <div className="overflow-hidden rounded-2xl border border-forward-200 bg-forward-50 shadow-lg">
          <div className="border-b border-forward-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-forward-900">Life Feed</p>
            <p className="text-xs text-forward-500">What your AI noticed</p>
          </div>
          <ul className="divide-y divide-forward-200 bg-white">
            {LIFE_FEED_EXAMPLES.map((item) => (
              <li key={item.text} className="flex gap-3 px-4 py-4">
                <span className="text-xl" aria-hidden>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-forward-800">{item.text}</p>
                  <p className="mt-1 text-xs text-forward-400">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
