"use client";

import { useEffect, useState } from "react";
import type { KashuProfileFields } from "@forward/shared";
import {
  createKashuIntl,
  defaultCurrencyForLocale,
  detectBrowserMoneyPrefs,
  KASHU_CURRENCIES,
  KASHU_LOCALES,
} from "@/lib/kashu/intl";
import { Button } from "@/components/button";

export function KashuRegionSettings({
  profile,
  busy,
  onSave,
}: {
  profile: KashuProfileFields;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [locale, setLocale] = useState(profile.preferredLocale);
  const [currency, setCurrency] = useState(profile.preferredCurrency);
  const [showDetected, setShowDetected] = useState(false);
  const intl = createKashuIntl(locale, currency);

  useEffect(() => {
    setLocale(profile.preferredLocale);
    setCurrency(profile.preferredCurrency);
  }, [profile.preferredCurrency, profile.preferredLocale]);

  useEffect(() => {
    const detected = detectBrowserMoneyPrefs();
    setShowDetected(
      detected.locale !== profile.preferredLocale ||
        detected.currency !== profile.preferredCurrency
    );
  }, [profile.preferredCurrency, profile.preferredLocale]);

  const detected = detectBrowserMoneyPrefs();

  return (
    <div className="rounded-2xl border border-forward-200 bg-forward-50/50 p-4 md:p-5">
      <h3 className="text-sm font-semibold text-forward-900">{intl.t("settings.regionTitle")}</h3>
      <p className="mt-1 text-xs text-forward-500">{intl.t("settings.regionHint")}</p>
      {showDetected ? (
        <p className="mt-2 text-xs text-emerald-700">
          {intl.t("settings.autoDetected")}:{" "}
          {KASHU_LOCALES.find((l) => l.code === detected.locale)?.nativeLabel ?? detected.locale} ·{" "}
          {detected.currency}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-forward-600">{intl.t("settings.language")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
            value={locale}
            onChange={(e) => {
              const next = e.target.value;
              setLocale(next);
              if (currency === profile.preferredCurrency) {
                setCurrency(defaultCurrencyForLocale(next));
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
          <span className="text-forward-600">{intl.t("settings.currency")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {KASHU_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => {
            setLocale(detected.locale);
            setCurrency(detected.currency);
          }}
        >
          Use device settings
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={
            busy ||
            (locale === profile.preferredLocale && currency === profile.preferredCurrency)
          }
          onClick={() =>
            void onSave({
              preferredLocale: locale,
              preferredCurrency: currency,
            })
          }
        >
          {intl.t("settings.save")}
        </Button>
      </div>
    </div>
  );
}
