"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackCta } from "@/lib/analytics";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  trackEvent: string;
  trackProps?: Record<string, string | number | boolean | undefined>;
  children: ReactNode;
};

/** External CTA with click tracking (Plausible-ready + custom event). */
export function OutboundLink({
  trackEvent,
  trackProps,
  children,
  onClick,
  ...rest
}: Props) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        trackCta(trackEvent, trackProps);
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
