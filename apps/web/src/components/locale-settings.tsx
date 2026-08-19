"use client";

import { useEffect, useState } from "react";
import {
  defaultCurrencyForLocale,
  detectBrowserLocale,
  KASHU_CURRENCIES,
  KASHU_LOCALES,
} from "@forward/shared";
import { useAppLocale } from "@/components/locale-provider";
import { Button } from "@/components/button";

export function LocaleSettings() {
  const { locale, currency, t, setLocale, saving } = useAppLocale();
  const [draftLocale, setDraftLocale] = useState(locale);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraftLocale(locale);
    setDraftCurrency(currency);
  }, [currency, locale]);

  const detected = detectBrowserLocale();
  const detectedCurrency = defaultCurrencyForLocale(detected);
  const showDetected = detected !== locale || detectedCurrency !== currency;

  async function save() {
    setNotice(null);
    try {
      await setLocale(draftLocale, draftCurrency);
      setNotice(t("settings.savedLocale"));
    } catch {
      setNotice(t("common.loading"));
    }
  }

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-forward-900">{t("settings.title")}</h2>
      <p className="mt-1 text-sm text-forward-500">{t("settings.subtitle")}</p>

      {showDetected ? (
        <p className="mt-3 text-xs text-emerald-700">
          {t("settings.detected")}:{" "}
          {KASHU_LOCALES.find((l) => l.code === detected)?.nativeLabel ?? detected} · {detectedCurrency}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-forward-700">{t("settings.language")}</span>
          <p className="mt-0.5 text-xs text-forward-500">{t("settings.languageHint")}</p>
          <select
            className="mt-2 w-full rounded-lg border border-forward-200 bg-forward-50 px-3 py-2 text-sm"
            value={draftLocale}
            onChange={(e) => {
              const next = e.target.value;
              setDraftLocale(next);
              if (draftCurrency === currency) {
                setDraftCurrency(defaultCurrencyForLocale(next));
              }
            }}
          >
            {KASHU_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeLabel} ({l.label})
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="font-medium text-forward-700">{t("settings.currency")}</span>
          <p className="mt-0.5 text-xs text-forward-500">{t("settings.currencyHint")}</p>
          <select
            className="mt-2 w-full rounded-lg border border-forward-200 bg-forward-50 px-3 py-2 text-sm"
            value={draftCurrency}
            onChange={(e) => setDraftCurrency(e.target.value)}
          >
            {KASHU_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={() => {
            setDraftLocale(detected);
            setDraftCurrency(detectedCurrency);
          }}
        >
          {t("settings.useDevice")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving || (draftLocale === locale && draftCurrency === currency)}
          onClick={() => void save()}
        >
          {saving ? t("common.loading") : t("settings.saveLocale")}
        </Button>
      </div>

      {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
    </section>
  );
}
