"use client";

import { FamilyIntelLockedPreview } from "@/components/family/family-intel-locked-preview";

/**
 * Free-tier Family Intelligence upsell.
 * Renders the blurred module tease (not a plain purple banner) so users see
 * what upgrading unlocks. Live map stays clear above this.
 */
export function FamilyUpgradeCard({
  canUpgrade,
  onUpgraded,
}: {
  headline?: string;
  body?: string;
  canUpgrade: boolean;
  compact?: boolean;
  onUpgraded?: () => void;
}) {
  return (
    <FamilyIntelLockedPreview canUpgrade={canUpgrade} onUpgraded={onUpgraded} />
  );
}
