import type { TimelinePrepItem } from "@forward/shared";

export function eventPrepKey(startIso: string, title: string) {
  return `${startIso}|${title}`;
}

export function mergePrepItems(
  saved: TimelinePrepItem[] | null | undefined,
  items: TimelinePrepItem[]
): TimelinePrepItem[] {
  if (!saved?.length) return items;
  const doneByLabel = new Map(saved.map((p) => [p.label, p.done]));
  return items.map((p) => ({ ...p, done: doneByLabel.get(p.label) ?? p.done }));
}

export function prepPercentFromItems(items: TimelinePrepItem[] | null | undefined): number {
  if (!items?.length) return 0;
  return Math.round((items.filter((p) => p.done).length / items.length) * 100);
}

export function parsePrepItemsJson(raw: string | null | undefined): TimelinePrepItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TimelinePrepItem[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
