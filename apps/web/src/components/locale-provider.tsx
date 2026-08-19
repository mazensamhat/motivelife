"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createAppIntl,
  detectBrowserLocale,
  defaultCurrencyForLocale,
  localeIsRtl,
  normalizeCurrency,
  normalizeLocale,
  type AppIntl,
  type AppMessageKey,
  type KashuMessageKey,
} from "@forward/shared";

type LocaleContextValue = AppIntl & {
  setLocale: (locale: string, currency?: string) => Promise<void>;
  saving: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  initialCurrency,
  children,
}: {
  initialLocale: string;
  initialCurrency: string;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(() => normalizeLocale(initialLocale));
  const [currency, setCurrencyState] = useState(() => normalizeCurrency(initialCurrency));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocaleState(normalizeLocale(initialLocale));
    setCurrencyState(normalizeCurrency(initialCurrency));
  }, [initialCurrency, initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeIsRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  const intl = useMemo(() => createAppIntl(locale, currency), [currency, locale]);

  const setLocale = useCallback(async (nextLocale: string, nextCurrency?: string) => {
    const loc = normalizeLocale(nextLocale);
    const cur = normalizeCurrency(nextCurrency ?? defaultCurrencyForLocale(loc));
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: { locale: loc, currency: cur },
        }),
      });
      if (!res.ok) throw new Error("Failed to save language");
      setLocaleState(loc);
      setCurrencyState(cur);
      document.cookie = `ml_locale=${encodeURIComponent(loc)}; path=/; max-age=31536000; samesite=lax`;
      document.cookie = `ml_currency=${encodeURIComponent(cur)}; path=/; max-age=31536000; samesite=lax`;
      void fetch("/api/kashu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLocale: loc, preferredCurrency: cur }),
      }).catch(() => {});
    } finally {
      setSaving(false);
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      ...intl,
      setLocale,
      saving,
    }),
    [intl, saving, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useAppLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      ...createAppIntl("en", "USD"),
      setLocale: async () => {},
      saving: false,
    };
  }
  return ctx;
}

/** One-time device locale bootstrap for signed-in users without a saved preference. */
export function useAutoDetectLocale(enabled: boolean) {
  const { locale, currency, setLocale } = useAppLocale();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (window.localStorage.getItem("ml_locale_applied") === "1") return;
    const detected = detectBrowserLocale();
    const detectedCurrency = defaultCurrencyForLocale(detected);
    if (detected === locale && detectedCurrency === currency) {
      window.localStorage.setItem("ml_locale_applied", "1");
      return;
    }
    void setLocale(detected, detectedCurrency)
      .then(() => window.localStorage.setItem("ml_locale_applied", "1"))
      .catch(() => {});
  }, [currency, enabled, locale, setLocale]);
}

export type { AppMessageKey, KashuMessageKey };
