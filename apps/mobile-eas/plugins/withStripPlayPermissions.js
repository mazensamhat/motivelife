/**
 * Remove Play-rejected permissions that libraries / Expo templates reintroduce.
 *
 * 1) AndroidManifest tools:node="remove" (CNG / prebuild)
 * 2) Post-merge Gradle rewrite of the final AndroidManifest.xml so the
 *    shipped AAB cannot still list READ_MEDIA_* / unused Health Connect types
 *    (Play App Bundle Explorer was still showing these on versionCode 12).
 */
const {
  withAndroidManifest,
  withAppBuildGradle,
  AndroidConfig,
} = require("expo/config-plugins");

const STRIP_PERMISSIONS = [
  // Photo / video / storage
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  // Health Connect — unused (keep only Steps, Sleep, RestingHeartRate, Exercise)
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
  "android.permission.health.READ_WEIGHT",
  "android.permission.health.READ_DISTANCE",
  "android.permission.health.READ_STEPS_CADENCE",
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
const GRADLE_MARKER = "motivelifeStripMergedManifestPermissions";

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

function withManifestRemoves(config) {
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

function buildGradleSnippet() {
  const listLiteral = STRIP_PERMISSIONS.map((p) => `        "${p}"`).join(",\n");
  return `

// ${GRADLE_MARKER} — force-remove permissions from the FINAL merged manifest
def motivelifeStripPermissionNames = [
${listLiteral}
] as Set

tasks.configureEach { task ->
    def name = task.name
    if (!(name.startsWith("process") && name.endsWith("MainManifest"))) {
        return
    }
    task.doLast {
        def filesToEdit = new LinkedHashSet()
        try {
            if (task.hasProperty("mergedManifest")) {
                def mf = task.mergedManifest
                if (mf != null) {
                    def file = mf.get().asFile
                    if (file != null) filesToEdit << file
                }
            }
        } catch (Throwable ignored) {}
        try {
            if (task.hasProperty("multiApkManifestOutputDirectory")) {
                def dir = task.multiApkManifestOutputDirectory.get().asFile
                if (dir != null && dir.exists()) {
                    dir.eachFileRecurse { f ->
                        if (f.name == "AndroidManifest.xml") filesToEdit << f
                    }
                }
            }
        } catch (Throwable ignored) {}
        try {
            if (task.hasProperty("manifestOutputDirectory")) {
                def dir = task.manifestOutputDirectory.get().asFile
                if (dir != null && dir.exists()) {
                    dir.eachFileRecurse { f ->
                        if (f.name == "AndroidManifest.xml") filesToEdit << f
                    }
                }
            }
        } catch (Throwable ignored) {}

        filesToEdit.each { manifestFile ->
            if (manifestFile == null || !manifestFile.exists()) return
            def original = manifestFile.getText("UTF-8")
            def updated = original
            motivelifeStripPermissionNames.each { perm ->
                def quoted = java.util.regex.Pattern.quote(perm)
                updated = updated.replaceAll(
                    "(?s)<uses-permission[^>]*android:name=\\"" + quoted + "\\"[^>]*/>",
                    ""
                )
                updated = updated.replaceAll(
                    "(?s)<uses-permission[^>]*android:name=\\"" + quoted + "\\"[^>]*>\\\\s*</uses-permission>",
                    ""
                )
                updated = updated.replaceAll(
                    "(?s)<uses-permission-sdk-23[^>]*android:name=\\"" + quoted + "\\"[^>]*/>",
                    ""
                )
            }
            if (updated != original) {
                manifestFile.write(updated, "UTF-8")
                println("MotiveLife: stripped Play-rejected permissions from " + manifestFile)
            }
        }
    }
}
`;
}

function withGradleMergedManifestStrip(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      return config;
    }
    if (config.modResults.contents.includes(GRADLE_MARKER)) {
      return config;
    }
    config.modResults.contents =
      config.modResults.contents.trimEnd() + buildGradleSnippet();
    return config;
  });
}

function withStripPlayPermissions(config) {
  config = withManifestRemoves(config);
  config = withGradleMergedManifestStrip(config);
  return config;
}

module.exports = withStripPlayPermissions;
