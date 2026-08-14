"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  CheckSquare,
  Compass,
  Heart,
  HeartHandshake,
  Home,
  LayoutGrid,
  Link2,
  MapPin,
  Palette,
  Plane,
  Repeat,
  Settings,
  Sparkles,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import type { NavIconKey } from "@/lib/generation";
import { NAV_TO_PRODUCT, PRODUCT_SUITE, type ProductSuiteId } from "@/lib/product-suite";
import { ProductSuiteIcon } from "./product-icons";
import { cn } from "@/lib/utils";

/** Lucide fallbacks for life-area modules (Career, Money, …). */
export const NAV_ICON_MAP: Record<NavIconKey, LucideIcon> = {
  home: Home,
  goals: Target,
  tasks: CheckSquare,
  ai: Sparkles,
  learning: BookOpen,
  career: Briefcase,
  money: Wallet,
  health: Heart,
  habits: Repeat,
  social: Users,
  discover: Compass,
  relationships: HeartHandshake,
  family: MapPin,
  travel: Plane,
  hobbies: Palette,
  connect: Link2,
  memory: LayoutGrid,
  life_hub: LayoutGrid,
  intelligence: LayoutGrid,
  more: Settings,
  settings: Settings,
  feed: Compass,
  business: Briefcase,
  home_life: Home,
};

export function productIdForNav(icon: NavIconKey): ProductSuiteId | null {
  return NAV_TO_PRODUCT[icon as keyof typeof NAV_TO_PRODUCT] ?? null;
}

/** Suite product glyph with glow accent — used in sidebar / mobile chrome. */
export function SuiteNavGlyph({
  icon,
  active = false,
  size = "sm",
  /** dark = sidebar; light = bottom tabs on white */
  tone = "dark",
  className,
}: {
  icon: NavIconKey;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: "dark" | "light";
  className?: string;
}) {
  const productId = productIdForNav(icon);
  const sizes = {
    sm: "h-9 w-9",
    md: "h-10 w-10",
    lg: "h-11 w-11",
  };
  const glyph = {
    sm: "h-[22px] w-[22px]",
    md: "h-6 w-6",
    lg: "h-7 w-7",
  };

  if (!productId) {
    const Lucide = NAV_ICON_MAP[icon];
    return (
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-xl border",
          tone === "dark"
            ? "border-white/10 bg-white/[0.06] text-forward-300"
            : "border-forward-200 bg-forward-50 text-forward-600",
          sizes[size],
          className
        )}
      >
        <Lucide className={glyph[size]} strokeWidth={active ? 2.25 : 2} />
      </span>
    );
  }

  const product = PRODUCT_SUITE[productId];
  const stroke = tone === "dark" ? product.primaryLight : product.primary;
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-xl transition-all duration-200",
        sizes[size],
        active
          ? "border border-white/25 shadow-md"
          : tone === "dark"
            ? "border border-white/10 bg-white/[0.06]"
            : "border border-forward-200 bg-white",
        className
      )}
      style={
        active
          ? {
              background: `linear-gradient(145deg, ${product.primary}33 0%, rgba(255,255,255,0.08) 55%, ${product.primaryDark}44 100%)`,
              boxShadow: `0 0 18px -4px ${product.primary}99`,
            }
          : {
              boxShadow: `inset 0 0 12px -6px ${product.primary}55`,
            }
      }
    >
      <ProductSuiteIcon id={productId} className={glyph[size]} color={stroke} />
      {active ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2",
            tone === "dark" ? "border-forward-950" : "border-white"
          )}
          style={{ backgroundColor: product.primary }}
        />
      ) : null}
    </span>
  );
}
