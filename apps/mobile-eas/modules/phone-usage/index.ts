import { requireNativeModule } from "expo-modules-core";

type PhoneUsageNative = {
  isPhoneInUse: () => boolean;
};

let native: PhoneUsageNative | null = null;

try {
  native = requireNativeModule<PhoneUsageNative>("PhoneUsage");
} catch {
  native = null;
}

/**
 * Android: screen interactive and lock screen not showing.
 * Returns null when the native module is unavailable (iOS / web / pre-rebuild).
 */
export function isPhoneInUseNative(): boolean | null {
  if (!native) return null;
  try {
    return Boolean(native.isPhoneInUse());
  } catch {
    return null;
  }
}

export default { isPhoneInUseNative };
