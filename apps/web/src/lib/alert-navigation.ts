/**
 * Client-safe alert navigation helpers (no Prisma / Node imports).
 * Keep in sync with push family-type matching.
 */

/** Family Inbox alert types (geofence, road, weather, ping, etc.). */
export function isFamilyInboxAlertType(type: string) {
  return (
    type.startsWith("family_") ||
    type.includes("geofence") ||
    type.includes("road") ||
    type.includes("weather") ||
    type.includes("ping") ||
    type.includes("driving")
  );
}

function isModeOfLifePath(path: string) {
  return (
    path === "/" ||
    path === "/dashboard" ||
    path.startsWith("/dashboard?") ||
    path.startsWith("/dashboard#") ||
    path === "/my-life" ||
    path.startsWith("/my-life?") ||
    path.startsWith("/my-life#") ||
    path === "/mylife" ||
    path.startsWith("/mylife")
  );
}

/** Where tapping an alert should navigate — always Family Map for family types. */
export function resolveAlertNavigationHref(
  type: string,
  href: string | null | undefined
): string | null {
  const family = isFamilyInboxAlertType(type);
  const raw = typeof href === "string" ? href.trim() : "";
  if (raw) {
    if (family && isModeOfLifePath(raw)) {
      return "/family-map";
    }
    return raw;
  }
  return family ? "/family-map" : null;
}
