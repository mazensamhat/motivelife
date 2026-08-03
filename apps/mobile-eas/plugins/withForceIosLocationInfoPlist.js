/**
 * Last-pass Info.plist writer: guarantee Always + When-In-Use strings and
 * UIBackgroundModes=location survive every other plugin merge.
 * If these keys are missing from the IPA, iOS Settings will not offer Always.
 */
const { withInfoPlist } = require("expo/config-plugins");

const WHEN_IN_USE =
  "MotiveLife uses your location for MyMotiveFamily so your household can see where you are when you choose to share.";
const ALWAYS =
  "MotiveLife needs Always location so MyMotiveFamily can keep sharing your live position with your household when the app is in the background.";

function withForceIosLocationInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSLocationWhenInUseUsageDescription = WHEN_IN_USE;
    config.modResults.NSLocationAlwaysAndWhenInUseUsageDescription = ALWAYS;
    config.modResults.NSLocationAlwaysUsageDescription = ALWAYS;

    const modes = config.modResults.UIBackgroundModes;
    const list = Array.isArray(modes) ? modes.slice() : [];
    if (!list.includes("location")) list.push("location");
    config.modResults.UIBackgroundModes = list;

    return config;
  });
}

module.exports = withForceIosLocationInfoPlist;
