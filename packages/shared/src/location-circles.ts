/**
 * Circles — location-sharing containers for Family, Friends, and Custom groups.
 * FamilyHousehold remains the billing/home-base SKU. Circles are the map graph.
 * See docs/FAMILY_MAP_EXPERT_REVIEW.md
 */

export const LOCATION_CIRCLE_TYPES = ["FAMILY", "FRIENDS", "CUSTOM"] as const;
export type LocationCircleType = (typeof LOCATION_CIRCLE_TYPES)[number];

export const LOCATION_CIRCLE_TYPE_LABELS: Record<LocationCircleType, string> = {
  FAMILY: "Family",
  FRIENDS: "Friends",
  CUSTOM: "Custom",
};

/** Default posture — Friends must feel like Snapchat Map, not Life360. */
export const CIRCLE_DEFAULTS: Record<
  LocationCircleType,
  {
    maxMembers: number;
    defaultShareDurationMinutes: number | null; // null = until turned off
    allowPlaceIntelligence: boolean;
    allowDriveScore: boolean;
    allowSomethingDifferent: boolean;
    allowFamilyFlow: boolean;
    historyTtlHours: number;
    reciprocalLiveRequired: boolean;
  }
> = {
  FAMILY: {
    maxMembers: 6,
    defaultShareDurationMinutes: null,
    allowPlaceIntelligence: true,
    allowDriveScore: true,
    allowSomethingDifferent: true,
    allowFamilyFlow: true,
    historyTtlHours: 72,
    reciprocalLiveRequired: false,
  },
  FRIENDS: {
    maxMembers: 12,
    defaultShareDurationMinutes: 120,
    allowPlaceIntelligence: false,
    allowDriveScore: false,
    allowSomethingDifferent: false,
    allowFamilyFlow: false,
    historyTtlHours: 4,
    reciprocalLiveRequired: true,
  },
  CUSTOM: {
    maxMembers: 12,
    defaultShareDurationMinutes: 240,
    allowPlaceIntelligence: false,
    allowDriveScore: false,
    allowSomethingDifferent: false,
    allowFamilyFlow: false,
    historyTtlHours: 24,
    reciprocalLiveRequired: true,
  },
};

export type LocationCircleSummary = {
  id: string;
  name: string;
  type: LocationCircleType;
  memberCount: number;
  isActiveShare: boolean;
};
