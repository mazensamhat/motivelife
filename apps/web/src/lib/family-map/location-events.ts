/**
 * In-process event fan-out after location ingest side-effects.
 * Keep handlers here so ingestLocationPing stays a thin state machine.
 */
import { applyLifeImpactFromTrip } from "./life-impact";
import { notifyHouseholdTripEnded, type TripEndedPayload } from "./trip-events";

export type LocationDomainEvent =
  | { type: "trip.ended"; payload: TripEndedPayload & {
      shareDigitalTwinIntegration: boolean;
    } }
  | { type: "location.updated"; payload: { memberId: string; householdId: string } };

type Handler = (event: LocationDomainEvent) => Promise<void>;

const handlers: Handler[] = [
  async (event) => {
    if (event.type !== "trip.ended") return;
    const p = event.payload;
    await notifyHouseholdTripEnded(p);
  },
  async (event) => {
    if (event.type !== "trip.ended") return;
    const p = event.payload;
    if (!p.userId) return;
    await applyLifeImpactFromTrip({
      memberId: p.actorMemberId,
      userId: p.userId,
      displayName: p.actorDisplayName,
      shareDigitalTwinIntegration: p.shareDigitalTwinIntegration !== false,
      shareDrivingData: p.shareDrivingData,
      toLabel: p.toLabel,
      distanceKm: p.distanceKm,
      durationMinutes: p.durationMinutes,
      driveScore: p.driveScore,
      estimatedFuelCostCad: p.estimatedFuelCostCad,
      endedAt: p.endedAt,
    });
  },
];

/** Fire-and-forget fan-out — never blocks the GPS ingest path. */
export function emitLocationEvent(event: LocationDomainEvent): void {
  for (const handler of handlers) {
    void handler(event).catch((err) => {
      console.warn("[location-events]", event.type, err);
    });
  }
}
