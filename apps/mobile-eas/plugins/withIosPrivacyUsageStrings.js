/**
 * Ensure mic / photo / camera usage strings stay in Info.plist.
 * iOS only lists these under Settings after the app declares + touches them.
 */
const { withInfoPlist } = require("expo/config-plugins");

const STRINGS = {
  NSMicrophoneUsageDescription:
    "MotiveLife uses the microphone for Voice Organize — speak your thoughts and get plans, goals, and tasks.",
  NSCameraUsageDescription:
    "MotiveLife uses the camera so you can take a profile photo for your Life Circle.",
  NSPhotoLibraryUsageDescription:
    "MotiveLife needs photo library access so you can choose a profile photo.",
  NSPhotoLibraryAddUsageDescription:
    "MotiveLife may save photos you choose for your profile.",
  NSHealthShareUsageDescription:
    "MotiveLife reads steps, sleep, heart rate, and workouts from Apple Health to power your Life Brief and coaching insights.",
  NSHealthUpdateUsageDescription:
    "MotiveLife may save wellness insights you choose to write back to Apple Health.",
};

function withIosPrivacyUsageStrings(config) {
  return withInfoPlist(config, (config) => {
    for (const [key, value] of Object.entries(STRINGS)) {
      config.modResults[key] = value;
    }
    config.modResults.CFBundleAllowMixedLocalizations = true;
    return config;
  });
}

module.exports = withIosPrivacyUsageStrings;
