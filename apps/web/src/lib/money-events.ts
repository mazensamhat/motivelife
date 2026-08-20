export const MONEY_UPDATED_EVENT = "motivelife:money-updated";
/** Fired after Kashu statement scan / auto-pin so calendar, radar, bills, buffers all reload. */
export const KASHU_UPDATED_EVENT = "motivelife:kashu-updated";

export function notifyMoneyUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MONEY_UPDATED_EVENT));
  }
}

export function notifyKashuUpdated(detail?: { source?: string; autoPinned?: number }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MONEY_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(KASHU_UPDATED_EVENT, { detail: detail ?? {} }));
}
