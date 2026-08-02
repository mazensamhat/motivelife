/**
 * Force ACCESS_*_LOCATION (+ background / FGS) into the Android manifest.
 * Uses tools:node="merge" so Play strip / library merges cannot drop Location
 * from App info → Permissions.
 */
const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const LOCATION_PERMISSIONS = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.WAKE_LOCK",
];

function upsertPermission(manifest, permission) {
  if (!Array.isArray(manifest.manifest["uses-permission"])) {
    manifest.manifest["uses-permission"] = [];
  }
  const entries = manifest.manifest["uses-permission"];
  const existing = entries.find((entry) => entry?.$?.["android:name"] === permission);
  if (existing) {
    // Never leave a remove-node on location — that hides it from Settings.
    if (existing.$["tools:node"] === "remove") {
      delete existing.$["tools:node"];
    }
    existing.$["tools:node"] = "merge";
    return;
  }
  entries.push({
    $: {
      "android:name": permission,
      "tools:node": "merge",
    },
  });
}

function withEnsureAndroidLocation(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    for (const permission of LOCATION_PERMISSIONS) {
      upsertPermission(config.modResults, permission);
    }
    return config;
  });
}

module.exports = withEnsureAndroidLocation;
