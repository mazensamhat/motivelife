/**
 * Native Sign in with Apple (iOS only).
 * Web OAuth inside WKWebView is unreliable — use the system sheet instead.
 */
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

export type NativeAppleSignInResult =
  | {
      ok: true;
      identityToken: string;
      email: string | null;
      fullName: string | null;
      user: string;
    }
  | { ok: false; cancelled?: boolean; message: string };

export async function isNativeAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithAppleNative(): Promise<NativeAppleSignInResult> {
  if (Platform.OS !== "ios") {
    return { ok: false, message: "Apple sign-in is only available on iPhone and iPad." };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return {
        ok: false,
        message: "Sign in with Apple isn’t available on this device. Use email sign-in.",
      };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return {
        ok: false,
        message: "Apple didn’t return a sign-in token. Try again, or use email sign-in.",
      };
    }

    const parts = [
      credential.fullName?.givenName,
      credential.fullName?.middleName,
      credential.fullName?.familyName,
    ].filter(Boolean);

    return {
      ok: true,
      identityToken: credential.identityToken,
      email: credential.email ?? null,
      fullName: parts.length ? parts.join(" ") : null,
      user: credential.user,
    };
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
      return { ok: false, cancelled: true, message: "Apple sign-in was cancelled." };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Couldn’t complete Apple sign-in.",
    };
  }
}
