/**
 * Per-member recipient alert preferences (what you want to hear about others).
 */

export type FamilyAlertPrefKind =
  | "arrive"
  | "leave"
  | "driving"
  | "road_hazards"
  | "still_there"
  | "no_show";

export type FamilyAlertPrefs = {
  alertArrive: boolean;
  alertLeave: boolean;
  alertDriving: boolean;
  alertRoadHazards: boolean;
  alertStillThere: boolean;
  alertNoShow: boolean;
};

export const DEFAULT_FAMILY_ALERT_PREFS: FamilyAlertPrefs = {
  alertArrive: true,
  alertLeave: true,
  alertDriving: true,
  alertRoadHazards: true,
  alertStillThere: true,
  alertNoShow: true,
};

export function wantsFamilyAlert(
  prefs: Partial<FamilyAlertPrefs> | null | undefined,
  kind: FamilyAlertPrefKind
): boolean {
  if (!prefs) return true;
  switch (kind) {
    case "arrive":
      return prefs.alertArrive !== false;
    case "leave":
      return prefs.alertLeave !== false;
    case "driving":
      return prefs.alertDriving !== false;
    case "road_hazards":
      // New column; fall back to driving toggle for older rows mid-migrate.
      if (prefs.alertRoadHazards === undefined) {
        return prefs.alertDriving !== false;
      }
      return prefs.alertRoadHazards !== false;
    case "still_there":
      return prefs.alertStillThere !== false;
    case "no_show":
      return prefs.alertNoShow !== false;
    default:
      return true;
  }
}
