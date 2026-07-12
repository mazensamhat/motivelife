import type { Metadata } from "next";
import { PLATFORMS } from "@/lib/platforms";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Motive-Corp for partnerships, press, and platform support.",
};

export default function ContactPage() {
  return (
    <div className="pt-16">
      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">
          Contact
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-bold sm:text-5xl">
          Let&apos;s talk
        </h1>
        <p className="mt-5 text-mist">
          Partnerships, press, and general inquiries for Motive-Corp. For product
          support or billing, use the help channels on each platform site.
        </p>

        <div className="mt-10 space-y-4">
          <a
            href="mailto:hello@motive-corp.com"
            className="block rounded-2xl border border-gold/30 bg-gold/5 px-6 py-5 transition hover:border-gold/60"
          >
            <p className="text-xs tracking-[0.2em] text-gold uppercase">Email</p>
            <p className="mt-1 text-xl font-semibold">hello@motive-corp.com</p>
          </a>

          <div className="rounded-2xl border border-white/10 bg-panel px-6 py-5">
            <p className="text-xs tracking-[0.2em] text-gold-dim uppercase">
              Product support
            </p>
            <ul className="mt-4 space-y-2 text-sm text-mist">
              {PLATFORMS.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-snow"
                  >
                    {p.name} → {p.siteUrl.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
