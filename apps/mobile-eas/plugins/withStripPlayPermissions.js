/**
 * Remove Play-rejected permissions that libraries / Expo templates reintroduce.
 *
 * Play App Bundle Explorer showed version 12/13 still shipping READ_MEDIA_IMAGES
 * and unused Health Connect reads despite tools:node="remove". This plugin:
 * 1) Adds manifest tools:node="remove" during prebuild
 * 2) Rewrites AndroidManifest.xml under app/build after manifest/package tasks
 * 3) Fails release/bundle packaging if forbidden permissions are still present
 */
const {
  withAndroidManifest,
  withAppBuildGradle,
  AndroidConfig,
} = require("expo/config-plugins");

const STRIP_PERMISSIONS = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
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
const GRADLE_MARKER = "motivelifeStripMergedManifestPermissionsV2";

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

const REQUIRED_LOCATION_PERMISSIONS = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
];

function assertLocationPermissionsPresent(manifest) {
  const entries = Array.isArray(manifest.manifest["uses-permission"])
    ? manifest.manifest["uses-permission"]
    : [];
  for (const permission of REQUIRED_LOCATION_PERMISSIONS) {
    const hit = entries.find((entry) => entry?.$?.["android:name"] === permission);
    if (!hit) {
      throw new Error(
        `MotiveLife: required ${permission} missing from AndroidManifest after strip pass.`
      );
    }
    if (hit.$?.["tools:node"] === "remove") {
      throw new Error(
        `MotiveLife: required ${permission} was marked tools:node=remove — Location would vanish from App Settings.`
      );
    }
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
    assertLocationPermissionsPresent(config.modResults);
    return config;
  });
}

function buildGradleSnippet() {
  const listLiteral = STRIP_PERMISSIONS.map((p) => `        "${p}"`).join(",\n");
  // NOTE: This return value is Groovy source. Escape `${` as \${ so JS does not interpolate.
  return `

// ${GRADLE_MARKER}
ext.motivelifeStripPermissionNames = [
${listLiteral}
] as Set

def motivelifeStripPermissionsInFile = { File manifestFile ->
    if (manifestFile == null || !manifestFile.exists() || !manifestFile.name.equalsIgnoreCase("AndroidManifest.xml")) {
        return false
    }
    byte[] header = new byte[Math.min(64, (int) manifestFile.length())]
    manifestFile.withInputStream { stream -> stream.read(header) }
    String probe = new String(header, "UTF-8")
    if (!probe.contains("<manifest") && !probe.contains("<?xml")) {
        return false
    }

    String original = manifestFile.getText("UTF-8")
    String updated = original
    motivelifeStripPermissionNames.each { perm ->
        String quoted = java.util.regex.Pattern.quote(perm)
        updated = updated.replaceAll(
            "(?is)<uses-permission\\\\b[^>]*android:name\\\\s*=\\\\s*\\"" + quoted + "\\"[^>]*/>",
            ""
        )
        updated = updated.replaceAll(
            "(?is)<uses-permission\\\\b[^>]*android:name\\\\s*=\\\\s*\\"" + quoted + "\\"[^>]*>\\\\s*</uses-permission\\\\s*>",
            ""
        )
        updated = updated.replaceAll(
            "(?is)<uses-permission-sdk-23\\\\b[^>]*android:name\\\\s*=\\\\s*\\"" + quoted + "\\"[^>]*/>",
            ""
        )
        updated = updated.replaceAll(
            "(?is)<uses-permission-sdk-23\\\\b[^>]*android:name\\\\s*=\\\\s*\\"" + quoted + "\\"[^>]*>\\\\s*</uses-permission-sdk-23\\\\s*>",
            ""
        )
    }
    if (updated != original) {
        manifestFile.write(updated, "UTF-8")
        println("MotiveLife: stripped Play-rejected permissions from " + manifestFile)
        return true
    }
    return false
}

def motivelifeCollectManifests = { File root ->
    def found = []
    if (root == null || !root.exists()) return found
    if (root.isFile()) {
        if (root.name.equalsIgnoreCase("AndroidManifest.xml")) found << root
        return found
    }
    root.eachFileRecurse { f ->
        if (f.isFile() && f.name.equalsIgnoreCase("AndroidManifest.xml")) {
            found << f
        }
    }
    return found
}

def motivelifeAssertNoForbiddenPermissions = { File root, String label ->
    def offenders = []
    motivelifeCollectManifests(root).each { manifestFile ->
        byte[] header = new byte[Math.min(64, (int) manifestFile.length())]
        manifestFile.withInputStream { stream -> stream.read(header) }
        String probe = new String(header, "UTF-8")
        if (!probe.contains("<manifest") && !probe.contains("<?xml")) {
            return
        }
        String text = manifestFile.getText("UTF-8")
        motivelifeStripPermissionNames.each { perm ->
            String quoted = java.util.regex.Pattern.quote(perm)
            def pattern = java.util.regex.Pattern.compile(
                "(?is)<uses-permission\\\\b[^>]*android:name\\\\s*=\\\\s*\\"" + quoted + "\\"[^>]*/?>"
            )
            def matcher = pattern.matcher(text)
            while (matcher.find()) {
                String tag = matcher.group(0)
                if (!tag.contains('tools:node="remove"') && !tag.contains("tools:node='remove'")) {
                    offenders << (manifestFile.path + " -> " + perm)
                }
            }
        }
    }
    if (!offenders.isEmpty()) {
        throw new GradleException(
            "MotiveLife: forbidden permissions still present after strip (" + label + "):\\n - " +
                offenders.unique().join("\\n - ")
        )
    } else {
        println("MotiveLife: permission strip verified clean for " + label)
    }
}

tasks.configureEach { task ->
    String name = task.name
    boolean manifestTask =
        (name.startsWith("process") && name.toLowerCase().contains("manifest")) ||
        name.toLowerCase().contains("processapplicationmanifest")
    boolean packageTask =
        name == "packageReleaseBundle" ||
        name == "packageRelease" ||
        name == "bundleRelease" ||
        name == "signReleaseBundle" ||
        name == "packageBundleRelease"

    if (!manifestTask && !packageTask) {
        return
    }

    task.doLast {
        def filesToEdit = new LinkedHashSet()
        try {
            task.outputs.files.each { f ->
                filesToEdit.addAll(motivelifeCollectManifests(f))
            }
        } catch (Throwable ignored) {}

        [
            file("\${buildDir}/intermediates"),
            file("\${buildDir}/generated"),
            file("\${project.buildDir}/intermediates"),
        ].each { root ->
            filesToEdit.addAll(motivelifeCollectManifests(root))
        }

        int changed = 0
        filesToEdit.each { manifestFile ->
            if (motivelifeStripPermissionsInFile(manifestFile)) changed++
        }
        println("MotiveLife: manifest strip task=" + name + " files=" + filesToEdit.size() + " changed=" + changed)

        if (packageTask || name.toLowerCase().contains("release")) {
            motivelifeAssertNoForbiddenPermissions(file("\${buildDir}/intermediates"), name)
        }
    }

    if (packageTask) {
        task.doFirst {
            [
                file("\${buildDir}/intermediates"),
                file("\${buildDir}/generated"),
            ].each { root ->
                motivelifeCollectManifests(root).each { manifestFile ->
                    motivelifeStripPermissionsInFile(manifestFile)
                }
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
