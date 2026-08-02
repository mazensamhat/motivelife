import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIC_IOS = {
  key: "NSMicrophoneUsageDescription",
  value:
    "MotiveLife uses the microphone for Voice Organize — speak your thoughts and turn them into plans, goals, and tasks.",
};

const LOCATION_IOS = [
  {
    key: "NSLocationWhenInUseUsageDescription",
    value:
      "MyMotiveFamily uses your location to show your live position on the Intelligent Family Map, detect places, and build Drive Score — only while the app is in use and only with your sharing settings.",
  },
  {
    key: "NSLocationAlwaysAndWhenInUseUsageDescription",
    value:
      "MyMotiveFamily can use location to keep Family Flow and arrival ETAs accurate when you choose continuous sharing. You control sharing level anytime.",
  },
];

const MIC_ANDROID = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
];

const LOCATION_ANDROID = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
];

const HEALTH_CONNECT_PERMISSIONS = [
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_DISTANCE",
  "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_WEIGHT",
];

const PRIVACY_POLICY_URL = "https://www.mymotivelife.com/privacy";

function patchIosInfoPlist() {
  const path = join(root, "ios", "App", "App", "Info.plist");
  if (!existsSync(path)) return;

  let xml = readFileSync(path, "utf8");
  let changed = false;

  const entries = [MIC_IOS, ...LOCATION_IOS];
  for (const entry of entries) {
    if (xml.includes(entry.key)) continue;
    const insert = `\t<key>${entry.key}</key>\n\t<string>${entry.value}</string>\n`;
    xml = xml.replace("</dict>\n</plist>", `${insert}</dict>\n</plist>`);
    changed = true;
  }

  if (changed) {
    writeFileSync(path, xml);
    console.log("[mobile] Patched iOS Info.plist (microphone + location)");
  }
}

function ensurePermission(xml, perm) {
  if (xml.includes(perm)) return { xml, changed: false };
  const line = `    <uses-permission android:name="${perm}" />`;
  return {
    xml: xml.replace(/<manifest([^>]*)>/, `<manifest$1>\n${line}`),
    changed: true,
  };
}

function patchAndroidManifest() {
  const path = join(root, "android", "app", "src", "main", "AndroidManifest.xml");
  if (!existsSync(path)) return;

  let xml = readFileSync(path, "utf8");
  let changed = false;

  for (const perm of [...MIC_ANDROID, ...LOCATION_ANDROID, ...HEALTH_CONNECT_PERMISSIONS]) {
    const result = ensurePermission(xml, perm);
    xml = result.xml;
    changed = changed || result.changed;
  }

  // Health Connect permission rationale intent (Android 13 and below).
  if (!xml.includes("androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE")) {
    const rationaleFilter = `
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>`;
    xml = xml.replace(
      /(android:name="\.MainActivity"[\s\S]*?)(<\/activity>)/,
      `$1${rationaleFilter}\n        $2`,
    );
    changed = true;
  }

  // Android 14+ permission usage activity alias.
  if (!xml.includes("ViewPermissionUsageActivity")) {
    const alias = `
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity=".MainActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>`;
    xml = xml.replace("</application>", `${alias}\n    </application>`);
    changed = true;
  }

  if (changed) {
    writeFileSync(path, xml);
    console.log("[mobile] Patched AndroidManifest.xml (microphone + location + Health Connect)");
  }
}

function patchAndroidMinSdk() {
  const path = join(root, "android", "variables.gradle");
  if (!existsSync(path)) return;
  let text = readFileSync(path, "utf8");
  const next = text.replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 26");
  if (next !== text) {
    writeFileSync(path, next);
    console.log("[mobile] Raised minSdkVersion to 26 (Health Connect)");
  }
}

function patchPrivacyPolicyString() {
  const path = join(root, "android", "app", "src", "main", "res", "values", "strings.xml");
  if (!existsSync(path)) return;
  let xml = readFileSync(path, "utf8");
  if (xml.includes("health_connect_privacy_policy_url")) {
    const updated = xml.replace(
      /<string name="health_connect_privacy_policy_url">[^<]*<\/string>/,
      `<string name="health_connect_privacy_policy_url">${PRIVACY_POLICY_URL}</string>`,
    );
    if (updated !== xml) {
      writeFileSync(path, updated);
      console.log("[mobile] Updated Health Connect privacy policy URL");
    }
    return;
  }
  xml = xml.replace(
    "</resources>",
    `    <string name="health_connect_privacy_policy_url">${PRIVACY_POLICY_URL}</string>\n</resources>`,
  );
  writeFileSync(path, xml);
  console.log("[mobile] Added Health Connect privacy policy URL");
}

patchIosInfoPlist();
patchAndroidManifest();
patchAndroidMinSdk();
patchPrivacyPolicyString();
