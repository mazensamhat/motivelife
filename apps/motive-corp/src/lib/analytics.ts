/**
 * Lightweight outbound / CTA tracking.
 * Fires a Plausible-ready custom event when available; always safe no-op otherwise.
 * Use with data-track attributes or trackCta() on click.
 */

export type TrackPayload = {
  name: string;
  props?: Record<string, string | number | boolean | undefined>;
};

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean | undefined> },
    ) => void;
  }
}

export function trackCta(name: string, props?: TrackPayload["props"]) {
  if (typeof window === "undefined") return;

  const detail = { name, props };
  window.dispatchEvent(new CustomEvent("motive-corp:cta", { detail }));

  if (typeof window.plausible === "function") {
    window.plausible(name, props ? { props } : undefined);
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[motive-corp:cta]", name, props ?? {});
  }
}

/** Props to spread on primary CTA anchors/buttons */
export function ctaTrackAttrs(
  event: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    "data-track": event,
    ...(extra
      ? Object.fromEntries(
          Object.entries(extra).map(([k, v]) => [`data-track-${k}`, v]),
        )
      : {}),
  };
}
