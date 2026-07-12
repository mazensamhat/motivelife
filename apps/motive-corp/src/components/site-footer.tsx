import Image from "next/image";
import Link from "next/link";
import { CORP_LOGO, PLATFORMS } from "@/lib/platforms";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/50 bg-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Image
            src={CORP_LOGO}
            alt="Motive-Corp"
            width={220}
            height={88}
            className="h-14 w-auto object-contain"
          />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist">
            Innovate · Connect · Empower. One vision. Four platforms. Endless
            possibilities.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-dim uppercase">
            Platforms
          </p>
          <ul className="mt-4 space-y-2">
            {PLATFORMS.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/platforms/${p.slug}`}
                  className="text-sm text-mist transition hover:text-snow"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-dim uppercase">
            Company
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mist">
            <li>
              <Link href="/about" className="transition hover:text-snow">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition hover:text-snow">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="transition hover:text-snow">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="transition hover:text-snow">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line/30 py-5 text-center text-xs text-mist/70">
        © {new Date().getFullYear()} Motive-Corp. All rights reserved.
      </div>
    </footer>
  );
}
