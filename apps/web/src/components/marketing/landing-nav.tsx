import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { buttonClassName } from "@/components/button";

const LINKS = [
  { href: "#story", label: "Story" },
  { href: "#predictions", label: "Predictions" },
  { href: "#trust", label: "Trust" },
  { href: "#reviews", label: "Reviews" },
  { href: "#life-feed", label: "Life Feed" },
  { href: "/blog", label: "Blog" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-forward-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <BrandLogo href="/" size="md" className="shrink-0" variant="dark" />
        <nav className="hidden items-center gap-5 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-forward-300 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className={buttonClassName({
              variant: "ghost",
              className: "text-forward-200 hover:bg-white/10 hover:text-white",
            })}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={buttonClassName({
              size: "sm",
              className: "sm:px-5 sm:py-2.5 sm:text-sm",
            })}
          >
            Meet your AI
          </Link>
        </div>
      </div>
    </header>
  );
}
