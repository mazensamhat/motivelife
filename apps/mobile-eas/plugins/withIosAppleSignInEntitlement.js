/**
 * Force Sign in with Apple entitlement into the iOS binary.
 * Empty entitlements caused Apple "could not verify" failures in the shell.
 */
const { withEntitlementsPlist } = require("expo/config-plugins");

function withIosAppleSignInEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.developer.applesignin"] = ["Default"];
    return config;
  });
}

module.exports = withIosAppleSignInEntitlement;
