import Link from "next/link";

export function TrustStrip() {
  return (
    <section
      aria-label="Motive-Corp trust"
      className="border-y border-line/40 bg-ink/90"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 px-5 py-7 text-center sm:px-8 sm:py-8">
        <p className="text-sm leading-relaxed text-mist sm:text-base">
          Four operating platforms · Part of Motive-Corp · Trials &amp; demos on
          product sites
        </p>
        <Link
          href="/about"
          className="text-xs font-semibold tracking-wide text-gold transition hover:text-gold-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          About Motive-Corp
        </Link>
      </div>
    </section>
  );
}
