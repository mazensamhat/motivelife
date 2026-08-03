import type { FamilyMapMemberView, LocationSharingLevel } from "@forward/shared";

type RawMember = {
  id: string;
  displayName: string;
  role: "OWNER" | "MEMBER";
  color: string;
  isYou: boolean;
  isSimulated: boolean;
  locationSharingLevel: LocationSharingLevel;
  presence: FamilyMapMemberView["presence"];
  statusLabel: string;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
  batteryPercent: number | null;
  lastLocationAt: string | null;
  placeName: string | null;
  placeCategory: FamilyMapMemberView["placeCategory"];
  likelyDestination: string | null;
  destinationConfidence: number | null;
  etaMinutes: number | null;
  timeAtPlaceMinutes: number | null;
  driveScoreRecent: number | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  vehicleLabel: string | null;
};

/**
 * Family Map always shares precise location with the household.
 * Graduated sharing presets (destination-only, ETA-only, etc.) were removed.
 */
export function applyLocationPrivacy(
  member: RawMember,
  viewerIsSelf: boolean
): FamilyMapMemberView {
  return {
    ...member,
    isYou: viewerIsSelf,
    locationSharingLevel: "precise",
  };
}
