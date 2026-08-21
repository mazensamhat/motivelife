/**
 * Prefer a statement/ledger-backed checking balance when Buffers is empty, zeroed,
 * or stuck on a stale overdraft. Timing was inventing −$6k troughs from liquid=$0/−$955
 * while Jul statements closed near +$4.5k.
 */
export function chooseLiquidBalance(
  profileLiquid: number | null,
  derived: number | null
): { liquid: number | null; source: "profile" | "ledger" | "none" } {
  if (derived == null) {
    return {
      liquid: profileLiquid,
      source: profileLiquid != null ? "profile" : "none",
    };
  }
  const rounded = Math.round(derived * 100) / 100;
  if (profileLiquid == null) return { liquid: rounded, source: "ledger" };
  if (profileLiquid === 0 && rounded > 250) return { liquid: rounded, source: "ledger" };
  if (profileLiquid < 0 && rounded >= 0 && rounded - profileLiquid >= 500) {
    return { liquid: rounded, source: "ledger" };
  }
  return { liquid: profileLiquid, source: "profile" };
}
