import Link from "next/link";
import { Shield, Lock, Trash2, HeartHandshake } from "lucide-react";
import { TRUST_PILLARS } from "@/lib/marketing-copy";

const ICONS = [Shield, Lock, Trash2, HeartHandshake] as const;

export function LandingTrustSection() {
  return (
    <section id="trust" className="landing-hero-bg py-20 text-white sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">Trust</p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl">
          You&apos;re giving us your life. We take that seriously.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-forward-300">
          Calendar. Money. Health. Memories. Goals. Relationships. Trust isn&apos;t a footnote — it&apos;s the
          product.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-6 px-4 sm:grid-cols-2">
        {TRUST_PILLARS.map((pillar, i) => {
          const Icon = ICONS[i] ?? Shield;
          return (
            <div
              key={pillar.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <Icon className="mb-4 h-8 w-8 text-brand-cyan" aria-hidden />
              <h3 className="text-xl font-semibold">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-forward-300">{pillar.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-2xl px-4 text-center">
        <Link href="/privacy" className="text-sm font-medium text-brand-cyan hover:underline">
          Read our Privacy Policy →
        </Link>
      </div>
    </section>
  );
}
