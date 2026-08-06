/** Client-safe map pin / family card color helpers (no DB imports). */

export const FAMILY_MEMBER_COLOR_OPTIONS = [
  "#00c6ff",
  "#228be6",
  "#1c7ed6",
  "#7048e8",
  "#6f42c1",
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
