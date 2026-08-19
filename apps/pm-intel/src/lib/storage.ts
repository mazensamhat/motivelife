import type { RecapFile } from "./types";

const KEY = "pm-intel-imported-recaps-v1";

export function loadImportedRecaps(): RecapFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecapFile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveImportedRecaps(files: RecapFile[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(files));
}

export function clearImportedRecaps(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
