export const MONEY_UPDATED_EVENT = "motivelife:money-updated";

export function notifyMoneyUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MONEY_UPDATED_EVENT));
  }
}
