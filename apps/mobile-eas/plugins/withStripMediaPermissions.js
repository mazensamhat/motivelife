/**
 * Force-remove broad photo/video storage permissions from the merged
 * AndroidManifest, including uses-permission-sdk-23 variants that
 * android.blockedPermissions alone may miss.
 *
 * Required for Google Play Photo & Video Permissions policy compliance
 * (system photo picker / one-time access — no READ_MEDIA_*).
 */
const {
  withAndroidManifest,
  AndroidConfig,
} = require("expo/config-plugins");

const MEDIA_PERMISSIONS = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
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

  manifest.manifest["uses-permission"].push({
    $: {
      "android:name": permission,
      "tools:node": "remove",
    },
  });
}

function withStripMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Manifest.ensureToolsAvailable(
      config.modResults
    );
    for (const permission of MEDIA_PERMISSIONS) {
      stripAndBlock(config.modResults, permission);
    }
    return config;
  });
}

module.exports = withStripMediaPermissions;
