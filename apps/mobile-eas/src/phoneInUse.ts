/**
 * Resolve whether the phone looks "in use" for distracted-driving ticks.
 *
 * - Android (native module): screen on + unlocked — works while MotiveLife is
 *   backgrounded during Always location sharing.
 * - iOS / fallback: MotiveLife app is in the foreground (App Store–safe).
 */

import { AppState, Platform } from "react-native";

export function resolvePhoneInUse(): boolean {
  if (Platform.OS === "android") {
    try {
      // Local Expo module — present after prebuild/EAS that includes modules/.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("phone-usage") as {
        isPhoneInUseNative?: () => boolean | null;
      };
      const native = mod.isPhoneInUseNative?.();
      if (typeof native === "boolean") return native;
    } catch {
      // Module not linked yet (JS-only / old binary) — fall through.
    }
  }
  return AppState.currentState === "active";
}
