"use client";

import { cn } from "@/lib/utils";

const ICON_ASPECT = 335 / 285;

/** Official brand M mark — inline SVG (no missing PNG dependency) */
export function LogoMark({
  className,
  size = 56,
}: {
  className?: string;
  size?: number;
}) {
  const height = Math.round(size * ICON_ASPECT);

  return (
    <svg
      viewBox="0 0 285 335"
      width={size}
      height={height}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="ml-mark-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a00e0" />
          <stop offset="35%" stopColor="#0072ff" />
          <stop offset="65%" stopColor="#00c6ff" />
          <stop offset="100%" stopColor="#00ff87" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ml-mark-gradient)"
        d="M42 28 L142 307 L185 307 L285 28 L235 28 L163 248 L92 28 Z M72 28 L122 28 L142 78 L162 28 L212 28 L142 178 Z"
      />
    </svg>
  );
}
