/**
 * Circles — location-sharing containers for Family, Friends, and Custom groups.
 */
export declare const LOCATION_CIRCLE_TYPES: readonly ["FAMILY", "FRIENDS", "CUSTOM"];
export type LocationCircleType = (typeof LOCATION_CIRCLE_TYPES)[number];
export declare const LOCATION_CIRCLE_TYPE_LABELS: Record<LocationCircleType, string>;
export declare const CIRCLE_DEFAULTS: Record<
  LocationCircleType,
  {
    maxMembers: number;
    defaultShareDurationMinutes: number | null;
    allowPlaceIntelligence: boolean;
    allowDriveScore: boolean;
    allowSomethingDifferent: boolean;
    allowFamilyFlow: boolean;
    historyTtlHours: number;
    reciprocalLiveRequired: boolean;
  }
>;
export type LocationCircleSummary = {
  id: string;
  name: string;
  type: LocationCircleType;
  memberCount: number;
  isActiveShare: boolean;
};
