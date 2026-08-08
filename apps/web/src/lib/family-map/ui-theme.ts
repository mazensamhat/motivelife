/** Shared bubbly Family Map UI tokens (client-safe). */

export const FAMILY_BUBBLE_CARD =
  "relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90";

export const FAMILY_BUBBLE_CARD_PADDED =
  "relative overflow-hidden rounded-[1.5rem] bg-white px-5 py-5 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90";

export const FAMILY_BUBBLE_TILE =
  "rounded-2xl bg-forward-50/80 px-3 py-2.5 ring-1 ring-forward-100/80";

export const FAMILY_BUBBLE_PILL_ACTIVE =
  "rounded-full bg-forward-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm";

export const FAMILY_BUBBLE_PILL =
  "rounded-full bg-forward-100 px-2.5 py-1 text-[11px] font-semibold text-forward-700 transition hover:bg-forward-200";

export const FAMILY_BUBBLE_ROW =
  "flex w-full items-center gap-3 rounded-2xl bg-forward-50/70 px-3 py-2.5 text-left ring-1 ring-forward-100/80 transition hover:bg-white hover:shadow-sm";

export type CountSeverity = "calm" | "watch" | "alert";

export function countSeverity(n: number): CountSeverity {
  // After tighter telematics, 1–3 real events is “notice”, not alarm red.
  if (n <= 0) return "calm";
  if (n <= 3) return "watch";
  return "alert";
}
