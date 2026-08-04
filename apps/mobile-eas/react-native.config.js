/** Keep Android-only native modules out of the iOS binary. */
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
  },
};
