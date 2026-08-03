/**
 * Z Fold / large-screen hardening:
 * - largeHeap so Family Map WebView is less likely to OOM on unfold
 * - allow resize on cover↔inner display without forced portrait recreation
 */
const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

function withAndroidFoldHardening(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    const app = config.modResults.manifest.application?.[0];
    if (!app?.$) return config;

    app.$["android:largeHeap"] = "true";
    app.$["android:resizeableActivity"] = "true";

    const activities = app.activity;
    if (Array.isArray(activities)) {
      for (const activity of activities) {
        if (!activity?.$) continue;
        // Unlock orientation — portrait-only fights Z Fold cover/inner switching.
        if (activity.$["android:screenOrientation"] === "portrait") {
          activity.$["android:screenOrientation"] = "unspecified";
        }
        const cfg = String(activity.$["android:configChanges"] || "");
        const needed = [
          "keyboard",
          "keyboardHidden",
          "orientation",
          "screenSize",
          "screenLayout",
          "smallestScreenSize",
          "density",
          "uiMode",
        ];
        const set = new Set(
          cfg
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
        );
        for (const n of needed) set.add(n);
        activity.$["android:configChanges"] = [...set].join("|");
      }
    }

    return config;
  });
}

module.exports = withAndroidFoldHardening;
