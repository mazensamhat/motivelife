"use client";

import { useId, type ReactElement } from "react";
import type { ProductSuiteId } from "@/lib/product-suite";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
  /** Override accent; defaults to product primary */
  color?: string;
};

function useGlow(color: string) {
  const raw = useId().replace(/:/g, "");
  const fid = `pg-${raw}`;
  const defs = (
    <defs>
      <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.2" result="b" />
        <feFlood floodColor={color} floodOpacity="0.55" result="c" />
        <feComposite in="c" in2="b" operator="in" result="g" />
        <feMerge>
          <feMergeNode in="g" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
  return { fid, defs };
}

/** DayO — sunrise over a path */
export function DayOIcon({ className, color = PRODUCT_SUITE.dayo.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g filter={`url(#${fid})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round">
        <path d="M6 22c4-1.5 8-2.2 10-2.2S22 20.5 26 22" />
        <path d="M10 22 L14 28 M22 22 L18 28" opacity="0.7" />
        <path d="M16 18a6 6 0 0 1 6-6" strokeWidth="2" />
        <path d="M16 6v2.5M9.5 9.5l1.8 1.8M22.5 9.5l-1.8 1.8M7 16h2.5M23.5 16H26" />
        <circle cx="16" cy="14" r="3.2" fill={color} stroke="none" opacity="0.95" />
      </g>
    </svg>
  );
}

/** LifeVue — pin + lens + pulse */
export function LifeVueIcon({ className, color = PRODUCT_SUITE.lifevue.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g
        filter={`url(#${fid})`}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 27s-7.5-6.2-7.5-12.2a7.5 7.5 0 1 1 15 0C23.5 20.8 16 27 16 27z" />
        <circle cx="16" cy="14" r="3.2" />
        <circle cx="16" cy="14" r="1.2" fill={color} stroke="none" />
        <path d="M3 14h4.5l1.5-2 2 4 1.2-2H13" opacity="0.85" />
        <path d="M19 14h1.8l1.2-2 2 4 1.5-2H29" opacity="0.85" />
      </g>
    </svg>
  );
}

/** KINZO AI — family inside a map pin */
export function KinzoIcon({ className, color = PRODUCT_SUITE.kinzo.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g
        filter={`url(#${fid})`}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 28s-8-6.5-8-13a8 8 0 1 1 16 0c0 6.5-8 13-8 13z" />
        <circle cx="12.5" cy="12.2" r="1.5" fill={color} stroke="none" />
        <circle cx="19.5" cy="12.2" r="1.5" fill={color} stroke="none" />
        <circle cx="16" cy="15.2" r="1.35" fill={color} stroke="none" />
        <path d="M10.2 18.2c.6-1.4 1.8-2.1 3.3-2.1M21.8 18.2c-.6-1.4-1.8-2.1-3.3-2.1M14 18.5c.5-1 1.2-1.5 2-1.5s1.5.5 2 1.5" />
      </g>
    </svg>
  );
}

/** UPLIFT — rising arrow */
export function UpliftIcon({ className, color = PRODUCT_SUITE.uplift.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g
        filter={`url(#${fid})`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 22h20" opacity="0.55" strokeWidth="1.6" />
        <path d="M10 20 L18 8 L22 14" />
        <path d="M18 8h6v6" />
        <path d="M10 20 L14 16" opacity="0.7" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** VYRA AI — vortex swoosh */
export function VyraIcon({ className, color = PRODUCT_SUITE.vyra.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g filter={`url(#${fid})`} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 5c6 0 10 4.2 10 9.2 0 6.5-5.2 10.3-10 12.3" />
        <path d="M16 27c-6 0-10-4.2-10-9.2C6 11.3 11.2 7.5 16 5.5" opacity="0.85" />
        <path d="M11 16c0-3.2 2.2-5.5 5-5.5s5 2 5 5-2.2 5.2-5 5.2" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="1.6" fill={color} stroke="none" />
      </g>
    </svg>
  );
}

/** Kashu — Cash-Flow Intelligence mark with Safe to Spend */
export function KashuIcon({ className, color = PRODUCT_SUITE.kashu.primary }: IconProps) {
  const raw = useId().replace(/:/g, "");
  const fid = `pg-${raw}`;
  const gid = `kg-${raw}`;
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor={PRODUCT_SUITE.kashu.primaryLight} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={PRODUCT_SUITE.kashu.primaryDark} />
        </linearGradient>
        <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feFlood floodColor={color} floodOpacity="0.55" result="c" />
          <feComposite in="c" in2="b" operator="in" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${fid})`} fill="none" stroke={`url(#${gid})`} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 24c2.2 2.4 5.2 3.4 7.8 3.4 4.8 0 8.2-3.2 8.2-7.6 0-5.2-3.6-7.4-6.4-9.2-1.6-1-2.8-2-2.8-3.6 0-1.5 1.2-2.6 2.8-2.6 1.3 0 2.3.7 2.9 1.6" />
        <path d="M7.5 22.5c1.8 1.5 4.2 2.4 6.8 2.4" opacity="0.55" strokeWidth="1.4" />
        <path
          d="M15.2 11.2v1.1M15.2 20.6v1.1M13.4 13.2c.35-.9 1.1-1.45 2.15-1.45 1.25 0 2.1.65 2.1 1.65 0 .95-.55 1.4-1.7 1.75l-.85.25c-1.15.35-1.75.85-1.75 1.9 0 1.15.95 1.9 2.35 1.9 1.15 0 1.95-.5 2.35-1.35"
          strokeWidth="1.55"
        />
      </g>
    </svg>
  );
}

/** MotiveIQ — neural brain */
export function MotiveIqIcon({ className, color = PRODUCT_SUITE.motiveiq.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g filter={`url(#${fid})`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
        <path d="M10 12c0-3.5 2.6-6 6-6s6 2.5 6 6c1.8.4 3 2 3 4 0 1.6-.8 3-2.2 3.7V22c0 1.5-1.2 2.5-2.8 2.5h-8C10.4 24.5 9 23.5 9 22v-2.3C7.6 19 6.8 17.6 6.8 16c0-2 1.2-3.6 3.2-4z" />
        <circle cx="13" cy="13" r="1.1" fill={color} stroke="none" />
        <circle cx="19" cy="12.5" r="1.1" fill={color} stroke="none" />
        <circle cx="16" cy="17" r="1.1" fill={color} stroke="none" />
        <path d="M13 13l3 4M19 12.5l-3 4.5M13 13h6" opacity="0.8" />
      </g>
    </svg>
  );
}

/** Signals — radar sweep */
export function SignalsIcon({ className, color = PRODUCT_SUITE.signals.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g filter={`url(#${fid})`} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
        <circle cx="16" cy="16" r="9" opacity="0.45" />
        <circle cx="16" cy="16" r="5.5" opacity="0.7" />
        <circle cx="16" cy="16" r="2" fill={color} stroke="none" />
        <path d="M16 16 L24 9" strokeWidth="2" />
        <circle cx="24" cy="9" r="1.4" fill={color} stroke="none" />
      </g>
    </svg>
  );
}

/** Connect — linked nodes */
export function ConnectIcon({ className, color = PRODUCT_SUITE.connect.primary }: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g filter={`url(#${fid})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round">
        <circle cx="9" cy="11" r="3" fill={color} fillOpacity="0.25" />
        <circle cx="23" cy="11" r="3" fill={color} fillOpacity="0.25" />
        <circle cx="16" cy="22" r="3" fill={color} fillOpacity="0.25" />
        <path d="M11.5 12.5 L14.2 19.5M20.5 12.5 L17.8 19.5M12 11h8" />
      </g>
    </svg>
  );
}

/** Settings — gear */
export function SettingsProductIcon({
  className,
  color = PRODUCT_SUITE.settings.primary,
}: IconProps) {
  const { fid, defs } = useGlow(color);
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      {defs}
      <g filter={`url(#${fid})`} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M14.2 5.2h3.6l.6 2.4 2.2.9 2.1-1.3 2.5 2.5-1.3 2.1.9 2.2 2.4.6v3.6l-2.4.6-.9 2.2 1.3 2.1-2.5 2.5-2.1-1.3-2.2.9-.6 2.4h-3.6l-.6-2.4-2.2-.9-2.1 1.3-2.5-2.5 1.3-2.1-.9-2.2L5.2 17.8v-3.6l2.4-.6.9-2.2-1.3-2.1 2.5-2.5 2.1 1.3 2.2-.9.6-2.4z" />
        <circle cx="16" cy="16" r="3.2" />
      </g>
    </svg>
  );
}

const PRODUCT_ICON_MAP: Record<ProductSuiteId, (props: IconProps) => ReactElement> = {
  dayo: DayOIcon,
  lifevue: LifeVueIcon,
  kinzo: KinzoIcon,
  uplift: UpliftIcon,
  vyra: VyraIcon,
  kashu: KashuIcon,
  motiveiq: MotiveIqIcon,
  signals: SignalsIcon,
  connect: ConnectIcon,
  settings: SettingsProductIcon,
};

export function ProductSuiteIcon({
  id,
  className,
  color,
}: {
  id: ProductSuiteId;
  className?: string;
  color?: string;
}) {
  const Icon = PRODUCT_ICON_MAP[id];
  return <Icon className={className} color={color ?? PRODUCT_SUITE[id].primary} />;
}
