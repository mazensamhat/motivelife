import { cookies, headers } from "next/headers";
import {
  CURRENCY_COOKIE,
  DEFAULT_LIFE_PREFERENCES,
  LOCALE_COOKIE,
  resolveAppCurrency,
  resolveAppLocale,
  type LifePreference,
} from "@forward/shared";

export function parseUserPreferences(raw: string | null | undefined): LifePreference {
  if (!raw) return { ...DEFAULT_LIFE_PREFERENCES };
  try {
    return { ...DEFAULT_LIFE_PREFERENCES, ...(JSON.parse(raw) as LifePreference) };
  } catch {
    return { ...DEFAULT_LIFE_PREFERENCES };
  }
}

export async function readLocaleCookies() {
  const cookieStore = await cookies();
  return {
    locale: cookieStore.get(LOCALE_COOKIE)?.value ?? null,
    currency: cookieStore.get(CURRENCY_COOKIE)?.value ?? null,
  };
}

export async function resolveRequestLocale(preferenceLocale?: string | null) {
  const { locale: cookieLocale } = await readLocaleCookies();
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  return resolveAppLocale({ preferenceLocale, cookieLocale, acceptLanguage });
}

export async function resolveRequestCurrency(input: {
  preferenceCurrency?: string | null;
  locale: string;
}) {
  const { currency: cookieCurrency } = await readLocaleCookies();
  return resolveAppCurrency({
    preferenceCurrency: input.preferenceCurrency,
    cookieCurrency,
    locale: input.locale,
  });
}

export function localeCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 365) {
  return {
    path: "/",
    maxAge: maxAgeSeconds,
    sameSite: "lax" as const,
    httpOnly: false,
  };
}
