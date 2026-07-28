/**
 * Force-remove permissions that Google Play policy rejects when unused:
 * - Photo/video broad access (use system picker instead)
 * - Health Connect types we do not sync (keep only Steps, Sleep,
 *   RestingHeartRate, Exercise)
 *
 * Strips both uses-permission and uses-permission-sdk-23, then adds
 * tools:node="remove" so library manifests cannot reintroduce them.
 */
const {
  withAndroidManifest,
  AndroidConfig,
} = require("expo/config-plugins");

const STRIP_PERMISSIONS = [
  // Photo / video / storage
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  // Health Connect — unused reads (still appearing in Play App content)
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
  "android.permission.health.READ_WEIGHT",
  "android.permission.health.READ_DISTANCE",
  "android.permission.health.READ_STEPS_CADENCE",
  // Health Connect — all writes
  "android.permission.health.WRITE_WEIGHT",
  "android.permission.health.WRITE_HEART_RATE",
  "android.permission.health.WRITE_ACTIVE_CALORIES_BURNED",
  "android.permission.health.WRITE_DISTANCE",
  "android.permission.health.WRITE_STEPS",
  "android.permission.health.WRITE_STEPS_CADENCE",
  "android.permission.health.WRITE_SLEEP",
  "android.permission.health.WRITE_RESTING_HEART_RATE",
  "android.permission.health.WRITE_EXERCISE",
];

const PERMISSION_TAGS = ["uses-permission", "uses-permission-sdk-23"];

function stripAndBlock(manifest, permission) {
  for (const tag of PERMISSION_TAGS) {
    const entries = manifest.manifest[tag];
    if (!Array.isArray(entries)) continue;
    manifest.manifest[tag] = entries.filter(
      (entry) => entry?.$?.["android:name"] !== permission
    );
  }

  if (!Array.isArray(manifest.manifest["uses-permission"])) {
    manifest.manifest["uses-permission"] = [];
  }

  const alreadyBlocked = manifest.manifest["uses-permission"].some(
    (entry) =>
      entry?.$?.["android:name"] === permission &&
      entry?.$?.["tools:node"] === "remove"
  );
  if (!alreadyBlocked) {
    manifest.manifest["uses-permission"].push({
      $: {
        "android:name": permission,
        "tools:node": "remove",
      },
    });
  }
}

function withStripPlayPermissions(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Manifest.ensureToolsAvailable(
      config.modResults
    );
    for (const permission of STRIP_PERMISSIONS) {
      stripAndBlock(config.modResults, permission);
    }
    return config;
  });
}

module.exports = withStripPlayPermissions;
