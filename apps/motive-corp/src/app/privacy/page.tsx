import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="pt-16">
      <article className="prose-invert mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold">
          Privacy
        </h1>
        <p className="mt-6 leading-relaxed text-mist">
          Motive-Corp operates this portfolio website at motive-corp.com. We
          collect only what we need to run the site (e.g. basic analytics and
          outbound click metrics to our product platforms). Product accounts,
          billing, and personal data for each platform are governed by that
          platform&apos;s own privacy policy on its domain.
        </p>
        <p className="mt-4 leading-relaxed text-mist">
          Questions:{" "}
          <a href="mailto:hello@motive-corp.com" className="text-gold underline">
            hello@motive-corp.com
          </a>
        </p>
      </article>
    </div>
  );
}
