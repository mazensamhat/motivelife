import {
  approximateCoordinate,
  type FamilyMapMemberView,
  type LocationSharingLevel,
} from "@forward/shared";

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
};

/** Apply the member's sharing level for viewers who are not that member. */
export function applyLocationPrivacy(member: RawMember, viewerIsSelf: boolean): FamilyMapMemberView {
  if (viewerIsSelf) {
    return { ...member, isYou: true };
  }

  const level = member.locationSharingLevel;
  const base: FamilyMapMemberView = {
    ...member,
    isYou: false,
  };

  if (level === "off") {
    return {
      ...base,
      lat: null,
      lng: null,
      speedKmh: null,
      headingDeg: null,
      batteryPercent: null,
      placeName: null,
      placeCategory: null,
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: null,
      driveScoreRecent: null,
      presence: "unknown",
      statusLabel: "Location off",
    };
  }

  if (level === "driving_status_only") {
    return {
      ...base,
      lat: null,
      lng: null,
      headingDeg: null,
      placeName: null,
      placeCategory: null,
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: null,
      statusLabel:
        member.presence === "driving"
          ? "Driving"
          : member.presence === "moving"
            ? "Moving"
            : "Not driving",
    };
  }

  if (level === "eta_only") {
    return {
      ...base,
      lat: null,
      lng: null,
      speedKmh: null,
      headingDeg: null,
      placeName: null,
      placeCategory: null,
      timeAtPlaceMinutes: null,
      statusLabel: member.etaMinutes != null ? `ETA ${member.etaMinutes} min` : "ETA unavailable",
    };
  }

  if (level === "destination_only") {
    return {
      ...base,
      lat: null,
      lng: null,
      speedKmh: null,
      headingDeg: null,
      placeName: null,
      placeCategory: null,
      timeAtPlaceMinutes: null,
      statusLabel: member.likelyDestination
        ? `Heading to ${member.likelyDestination}`
        : member.statusLabel,
    };
  }

  if (level === "approximate" && member.lat != null && member.lng != null) {
    const approx = approximateCoordinate(member.lat, member.lng);
    return {
      ...base,
      lat: approx.lat,
      lng: approx.lng,
      speedKmh: null,
      headingDeg: null,
    };
  }

  return base;
}
