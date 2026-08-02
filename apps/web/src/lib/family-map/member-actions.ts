/** Client-safe helpers for Message / Call / Navigate from the intel sheet. */

export function mapsNavigateUrl(lat: number, lng: number, label?: string): string {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  // Google Maps works on desktop + Android; iOS Safari usually handoff to Apple Maps
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving&dir_action=navigate&q=${q}`;
}

export function appleMapsNavigateUrl(lat: number, lng: number, label?: string): string {
  const q = label ? encodeURIComponent(label) : "Destination";
  return `https://maps.apple.com/?daddr=${lat},${lng}&q=${q}&dirflg=d`;
}

export function telUrl(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function smsUrl(phone: string, body?: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  const text = body ? `?body=${encodeURIComponent(body)}` : "";
  // iOS uses & body; Android prefers ?body — browsers generally accept ?body=
  return `sms:${digits}${text}`;
}

export function preferAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}
