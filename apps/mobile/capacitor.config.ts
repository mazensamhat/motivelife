import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Production builds load the live site — web updates ship without an app store release.
 * Local dev: CAPACITOR_DEV=1 CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3002
 */
const isDev = process.env.CAPACITOR_DEV === "1";
const devUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const productionUrl = "https://www.mymotivelife.com";

const serverUrl = isDev && devUrl ? devUrl : productionUrl;

const config: CapacitorConfig = {
  appId: "com.mymotivelife.app",
  appName: "MotiveLife",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#050d18",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#050d18",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
