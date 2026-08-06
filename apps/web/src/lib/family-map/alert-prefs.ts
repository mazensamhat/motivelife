/**
 * Per-member recipient alert preferences (what you want to hear about others).
 */

export type FamilyAlertPrefKind = "arrive" | "leave" | "driving" | "still_there";

export type FamilyAlertPrefs = {
  alertArrive: boolean;
  alertLeave: boolean;
  alertDriving: boolean;
  alertStillThere: boolean;
};

export const DEFAULT_FAMILY_ALERT_PREFS: FamilyAlertPrefs = {
  alertArrive: true,
  alertLeave: true,
  alertDriving: true,
  alertStillThere: true,
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
    case "still_there":
      return prefs.alertStillThere !== false;
    default:
      return true;
  }
}
