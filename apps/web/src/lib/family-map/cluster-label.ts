/**
 * Shared place label for Life360-style member clusters on the Family Map.
 * Prefer the shared place *name* — category "home" alone is wrong for
 * parents' house / cottage / etc. saved under the Home category.
 */

export type ClusterLabelMember = {
  placeName?: string | null;
  placeCategory?: string | null;
};

function isHouseholdHomePlace(m: ClusterLabelMember): boolean {
  const name = m.placeName?.trim() ?? "";
  if (name) return /^home$/i.test(name);
  return m.placeCategory === "home";
}

export function clusterStatusLabel(
  members: ClusterLabelMember[],
  opts?: { isHouseholdHomePlace?: (m: ClusterLabelMember) => boolean }
): string {
  const homeCheck = opts?.isHouseholdHomePlace ?? isHouseholdHomePlace;
  const counts = new Map<string, number>();
  for (const m of members) {
    const n = m.placeName?.trim();
    if (!n) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [n, c] of counts) {
    if (c > bestN) {
      best = n;
      bestN = c;
    }
  }
  if (best) {
    if (/^home$/i.test(best)) return `${members.length} at Home`;
    return `${members.length} at ${best}`;
  }
  if (members.every((m) => homeCheck(m))) {
    return `${members.length} at Home`;
  }
  return `${members.length} together`;
}

/** Prefer a circular orb for 2×2 / small grids; tall soap-bubbles stretch on Android. */
export function clusterOrbLayout(input: {
  memberCount: number;
  tier: "full" | "compact" | "dot";
}): {
  cols: number;
  cell: number;
  gap: number;
  orbPad: number;
  orbSize: number;
} {
  const { memberCount, tier } = input;
  if (tier === "dot") {
    return { cols: 1, cell: 38, gap: 0, orbPad: 0, orbSize: 38 };
  }
  const cols = memberCount <= 4 ? 2 : Math.min(3, Math.ceil(Math.sqrt(memberCount)));
  const cell = tier === "compact" ? (memberCount <= 4 ? 30 : 26) : memberCount <= 4 ? 40 : 34;
  const gap = tier === "compact" ? 4 : 6;
  const orbPad = tier === "compact" ? 8 : 10;
  const gridSide = cols * cell + (cols - 1) * gap;
  const orbSize = gridSide + orbPad * 2;
  return { cols, cell, gap, orbPad, orbSize };
}
