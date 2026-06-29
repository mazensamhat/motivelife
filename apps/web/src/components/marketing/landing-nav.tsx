import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/button";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#modules", label: "Modules" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-forward-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <Logo variant="dark" size="sm" href="/" showTagline={false} />
        <nav className="hidden items-center gap-6 md:flex">
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
          <Link href="/login">
            <Button variant="ghost" className="text-forward-200 hover:bg-white/10 hover:text-white">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="sm:px-5 sm:py-2.5 sm:text-sm">
              Start free trial
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
