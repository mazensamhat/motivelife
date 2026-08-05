/**
 * When set (e.g. Mahdi pre-launch), skip Location system sheets and refuse
 * background GPS start. Cleared when Family Map goes live for that member.
 */
import * as SecureStore from "expo-secure-store";

const KEY = "motivelife.locationPaused";

export async function setLocationPaused(paused: boolean): Promise<void> {
  try {
    if (paused) {
      await SecureStore.setItemAsync(KEY, "1");
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch (e) {
    console.warn(
      "[locationPause] write",
      e instanceof Error ? e.message : e
    );
  }
}

export async function isLocationPaused(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}
