import type { KashuLocaleCode } from "../money-format";
import {
  defaultCurrencyForLocale,
  detectBrowserLocale,
  formatMoney,
  KASHU_CURRENCIES,
  KASHU_LOCALES,
  localeIsRtl,
  normalizeCurrency,
  normalizeLocale,
} from "../money-format";
import { appT, localizedGreeting, type AppMessageKey } from "./app-messages";
import { kashuT, kashuTabLabels, type KashuMessageKey } from "./kashu-messages";

export type { AppMessageKey, KashuMessageKey, KashuLocaleCode };
export {
  appT,
  localizedGreeting,
  kashuT,
  kashuTabLabels,
  KASHU_CURRENCIES,
  KASHU_LOCALES,
  formatMoney,
  normalizeLocale,
  normalizeCurrency,
  localeIsRtl,
  detectBrowserLocale,
  defaultCurrencyForLocale,
};

export const LOCALE_COOKIE = "ml_locale";
export const CURRENCY_COOKIE = "ml_currency";

export type AppIntl = {
  locale: string;
  currency: string;
  rtl: boolean;
  t: (key: AppMessageKey) => string;
  k: (key: KashuMessageKey, vars?: Record<string, string | number>) => string;
  money: (amount: number) => string;
  greeting: (hour?: number) => string;
};

export function createAppIntl(locale: string, currency?: string): AppIntl {
  const loc = normalizeLocale(locale);
  const cur = normalizeCurrency(currency ?? defaultCurrencyForLocale(loc));
  return {
    locale: loc,
    currency: cur,
    rtl: localeIsRtl(loc),
    t: (key) => appT(loc, key),
    k: (key, vars) => kashuT(loc, key, vars),
    money: (amount) => formatMoney(amount, { locale: loc, currency: cur }),
    greeting: (hour) => localizedGreeting(loc, hour),
  };
}

/** Resolve locale: explicit preference → cookie → Accept-Language → en */
export function resolveAppLocale(input: {
  preferenceLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): string {
  if (input.preferenceLocale) return normalizeLocale(input.preferenceLocale);
  if (input.cookieLocale) return normalizeLocale(input.cookieLocale);
  if (input.acceptLanguage) {
    const first = input.acceptLanguage.split(",")[0]?.trim();
    if (first) return normalizeLocale(first);
  }
  return "en";
}

export function resolveAppCurrency(input: {
  preferenceCurrency?: string | null;
  cookieCurrency?: string | null;
  locale: string;
}): string {
  if (input.preferenceCurrency) return normalizeCurrency(input.preferenceCurrency);
  if (input.cookieCurrency) return normalizeCurrency(input.cookieCurrency);
  return defaultCurrencyForLocale(input.locale);
}
