/** True when the page runs inside the MotiveLife Expo/WKWebView shell. */
export function isNativeShell(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("motivelife-native-shell");
}
