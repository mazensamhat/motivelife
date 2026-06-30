import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIC_IOS = {
  key: "NSMicrophoneUsageDescription",
  value:
    "MotiveLife uses the microphone for Voice Organize — speak your thoughts and turn them into plans, goals, and tasks.",
};

const MIC_ANDROID = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
];

function patchIosInfoPlist() {
  const path = join(root, "ios", "App", "App", "Info.plist");
  if (!existsSync(path)) return;

  let xml = readFileSync(path, "utf8");
  if (xml.includes(MIC_IOS.key)) return;

  const insert = `\t<key>${MIC_IOS.key}</key>\n\t<string>${MIC_IOS.value}</string>\n`;
  xml = xml.replace("</dict>\n</plist>", `${insert}</dict>\n</plist>`);
  writeFileSync(path, xml);
  console.log("[mobile] Patched iOS Info.plist (microphone)");
}

function patchAndroidManifest() {
  const path = join(root, "android", "app", "src", "main", "AndroidManifest.xml");
  if (!existsSync(path)) return;

  let xml = readFileSync(path, "utf8");
  let changed = false;

  for (const perm of MIC_ANDROID) {
    if (xml.includes(perm)) continue;
    const line = `    <uses-permission android:name="${perm}" />`;
    xml = xml.replace(/<manifest([^>]*)>/, `<manifest$1>\n${line}`);
    changed = true;
  }

  if (changed) {
    writeFileSync(path, xml);
    console.log("[mobile] Patched AndroidManifest.xml (microphone)");
  }
}

patchIosInfoPlist();
patchAndroidManifest();
