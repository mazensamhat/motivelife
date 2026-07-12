import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <div className="pt-16">
      <article className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold">
          Terms
        </h1>
        <p className="mt-6 leading-relaxed text-mist">
          This website is an informational portfolio for Motive-Corp and its
          platforms. Product features, trials, pricing, and subscriptions are
          offered under the terms of each individual platform. Links to third-party
          product sites may include tracking parameters so we can measure which
          Motive-Corp pages drive interest.
        </p>
        <p className="mt-4 leading-relaxed text-mist">
          Contact:{" "}
          <a href="mailto:hello@motive-corp.com" className="text-gold underline">
            hello@motive-corp.com
          </a>
        </p>
      </article>
    </div>
  );
}
