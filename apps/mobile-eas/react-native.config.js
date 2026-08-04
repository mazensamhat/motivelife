/** Keep platform-specific native modules out of the wrong binary. */
module.exports = {
  dependencies: {
    "react-native-health-connect": {
      platforms: {
        ios: null,
      },
    },
    "expo-health-connect": {
      platforms: {
        ios: null,
      },
    },
    // HealthKit / Nitro are iOS-only for MotiveLife; avoid Android link noise.
    "@kingstinct/react-native-healthkit": {
      platforms: {
        android: null,
      },
    },
  },
};
