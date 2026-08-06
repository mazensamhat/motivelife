/** Client-safe map pin / family card color helpers (no DB imports). */

export const FAMILY_MEMBER_COLOR_OPTIONS = [
  "#00c6ff",
  "#228be6",
  "#7048e8",
  "#be4bdb",
  "#ff6b9d",
  "#e03131",
  "#ff8c00",
  "#ffcc33",
  "#37b24d",
  "#12b886",
  "#15aabf",
  "#868e96",
] as const;

export function isFamilyMemberColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function memberColorPalette(current: string): readonly string[] {
  const normalized = current.toLowerCase();
  if (
    (FAMILY_MEMBER_COLOR_OPTIONS as readonly string[]).includes(normalized)
  ) {
    return FAMILY_MEMBER_COLOR_OPTIONS;
  }
  // Keep current custom color visible, but still show the 12-swatch set.
  return [normalized, ...FAMILY_MEMBER_COLOR_OPTIONS].slice(0, 12);
}
