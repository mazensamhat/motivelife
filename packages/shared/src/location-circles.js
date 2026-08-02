/**
 * Circles — location-sharing containers for Family, Friends, and Custom groups.
 */
export const LOCATION_CIRCLE_TYPES = ["FAMILY", "FRIENDS", "CUSTOM"];
export const LOCATION_CIRCLE_TYPE_LABELS = {
  FAMILY: "Family",
  FRIENDS: "Friends",
  CUSTOM: "Custom",
};
export const CIRCLE_DEFAULTS = {
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
