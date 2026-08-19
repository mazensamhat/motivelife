"use client";

import {
  detectBrowserMoneyPrefs,
  formatMoney,
  KASHU_CURRENCIES,
  KASHU_LOCALES,
  kashuT,
  localeIsRtl,
  normalizeCurrency,
  normalizeLocale,
  type KashuMessageKey,
  type MoneyFormatOptions,
} from "@forward/shared";

export {
  KASHU_CURRENCIES,
  KASHU_LOCALES,
  detectBrowserMoneyPrefs,
  defaultCurrencyForLocale,
  localeIsRtl,
  normalizeCurrency,
  normalizeLocale,
  kashuTabLabels,
} from "@forward/shared";

export type KashuIntl = {
  locale: string;
  currency: string;
  rtl: boolean;
  money: (amount: number, opts?: Partial<MoneyFormatOptions>) => string;
  t: (key: KashuMessageKey, vars?: Record<string, string | number>) => string;
};

export function createKashuIntl(locale: string, currency: string): KashuIntl {
  const loc = normalizeLocale(locale);
  const cur = normalizeCurrency(currency);
  return {
    locale: loc,
    currency: cur,
    rtl: localeIsRtl(loc),
    money: (amount, opts) => formatMoney(amount, { locale: loc, currency: cur, ...opts }),
    t: (key, vars) => kashuT(loc, key, vars),
  };
}
