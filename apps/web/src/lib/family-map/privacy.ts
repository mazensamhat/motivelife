import {
  approximateCoordinate,
  type FamilyMapMemberView,
  type LocationSharingLevel,
} from "@forward/shared";

type RawMember = {
  id: string;
  displayName: string;
  relationshipLabel: string | null;
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
 * Life360-style sharing levels — each member controls what the household sees.
 * Self always sees their own precise data.
 */
export function applyLocationPrivacy(
  member: RawMember,
  viewerIsSelf: boolean
): FamilyMapMemberView {
  const level = member.locationSharingLevel;

  if (viewerIsSelf) {
    return { ...member, isYou: true, locationSharingLevel: level };
  }

  if (level === "off") {
    return {
      ...member,
      isYou: false,
      locationSharingLevel: "off",
      lat: null,
      lng: null,
      speedKmh: null,
      headingDeg: null,
      placeName: null,
      placeCategory: null,
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: null,
      driveScoreRecent: null,
      presence: "unknown",
      statusLabel: "Location off",
      lastLocationAt: null,
    };
  }

  if (level === "driving_status_only") {
    return {
      ...member,
      isYou: false,
      locationSharingLevel: level,
      lat: null,
      lng: null,
      placeName: null,
      placeCategory: null,
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: null,
      headingDeg: null,
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
      ...member,
      isYou: false,
      locationSharingLevel: level,
      lat: null,
      lng: null,
      speedKmh: null,
      headingDeg: null,
      placeName: null,
      placeCategory: null,
      timeAtPlaceMinutes: null,
      statusLabel:
        member.etaMinutes != null && member.likelyDestination
          ? `ETA ${member.etaMinutes} min to ${member.likelyDestination}`
          : "ETA sharing",
    };
  }

  if (level === "destination_only") {
    return {
      ...member,
      isYou: false,
      locationSharingLevel: level,
      lat: null,
      lng: null,
      speedKmh: null,
      headingDeg: null,
      placeName: null,
      placeCategory: null,
      timeAtPlaceMinutes: null,
      statusLabel: member.likelyDestination
        ? `Heading to ${member.likelyDestination}`
        : "Destination sharing",
    };
  }

  if (level === "approximate" && member.lat != null && member.lng != null) {
    const approx = approximateCoordinate(member.lat, member.lng);
    return {
      ...member,
      isYou: false,
      locationSharingLevel: level,
      lat: approx.lat,
      lng: approx.lng,
      speedKmh: member.speedKmh != null ? Math.round(member.speedKmh / 5) * 5 : null,
      headingDeg: null,
    };
  }

  return {
    ...member,
    isYou: false,
    locationSharingLevel: level || "precise",
  };
}
