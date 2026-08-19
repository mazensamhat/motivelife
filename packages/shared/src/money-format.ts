/** Global currency formatting for Kashu and money modules. */

export const KASHU_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", label: "Saudi Riyal", symbol: "﷼" },
  { code: "AUD", label: "Australian Dollar", symbol: "$" },
  { code: "MXN", label: "Mexican Peso", symbol: "$" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "KRW", label: "South Korean Won", symbol: "₩" },
  { code: "SGD", label: "Singapore Dollar", symbol: "$" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "$" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "$" },
  { code: "ZAR", label: "South African Rand", symbol: "R" },
  { code: "TRY", label: "Turkish Lira", symbol: "₺" },
  { code: "PLN", label: "Polish Złoty", symbol: "zł" },
] as const;

export type KashuCurrencyCode = (typeof KASHU_CURRENCIES)[number]["code"];

export const KASHU_CURRENCY_CODES = KASHU_CURRENCIES.map((c) => c.code);

export type MoneyFormatOptions = {
  currency?: string;
  locale?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW"]);

export function normalizeCurrency(code: string | null | undefined): KashuCurrencyCode {
  const c = (code ?? "USD").toUpperCase();
  if ((KASHU_CURRENCY_CODES as readonly string[]).includes(c)) {
    return c as KashuCurrencyCode;
  }
  return "USD";
}

export function formatMoney(amount: number, opts: MoneyFormatOptions = {}): string {
  const currency = normalizeCurrency(opts.currency);
  const locale = normalizeLocale(opts.locale);
  const zeroDec = ZERO_DECIMAL_CURRENCIES.has(currency);
  const maximumFractionDigits =
    opts.maximumFractionDigits ?? (zeroDec ? 0 : 0);
  const minimumFractionDigits = opts.minimumFractionDigits ?? (zeroDec ? 0 : 0);
  try {
    return amount.toLocaleString(locale, {
      style: "currency",
      currency,
      maximumFractionDigits,
      minimumFractionDigits,
    });
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString(locale)}`;
  }
}

export function currencyLabel(code: string): string {
  return KASHU_CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

/** Map browser / BCP-47 tag to Kashu locale code. */
export function normalizeLocale(raw: string | null | undefined): string {
  if (!raw) return "en";
  const tag = raw.trim().replace("_", "-");
  const base = tag.split("-")[0]!.toLowerCase();
  const supported = new Set(KASHU_LOCALE_CODES);
  if (supported.has(tag.toLowerCase() as KashuLocaleCode)) return tag.toLowerCase();
  if (supported.has(base as KashuLocaleCode)) return base;
  return "en";
}

export const KASHU_LOCALES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
] as const;

export type KashuLocaleCode = (typeof KASHU_LOCALES)[number]["code"];
export const KASHU_LOCALE_CODES = KASHU_LOCALES.map((l) => l.code);

/** Suggest a default currency from locale / region tag. */
export function defaultCurrencyForLocale(locale: string): KashuCurrencyCode {
  const tag = (locale ?? "en").toLowerCase();
  if (tag.startsWith("ja")) return "JPY";
  if (tag.startsWith("zh")) return "CNY";
  if (tag.startsWith("hi")) return "INR";
  if (tag.startsWith("ar")) {
    if (tag.includes("sa")) return "SAR";
    return "AED";
  }
  if (tag.startsWith("en-ca")) return "CAD";
  if (tag.startsWith("en-gb") || tag.startsWith("en-uk")) return "GBP";
  if (tag.startsWith("en-au")) return "AUD";
  if (tag.startsWith("en-nz")) return "NZD";
  if (tag.startsWith("en-hk")) return "HKD";
  if (tag.startsWith("en-sg")) return "SGD";
  if (tag.startsWith("en-za")) return "ZAR";
  if (tag.startsWith("fr-ca")) return "CAD";
  if (tag.startsWith("es-mx")) return "MXN";
  if (tag.startsWith("pt-br")) return "BRL";
  if (tag.startsWith("de-ch") || tag.startsWith("fr-ch") || tag.startsWith("it-ch")) return "CHF";
  if (tag.startsWith("ko")) return "KRW";
  if (tag.startsWith("tr")) return "TRY";
  if (tag.startsWith("pl")) return "PLN";
  if (tag.startsWith("fr") || tag.startsWith("de") || tag.startsWith("it") || tag.startsWith("es")) return "EUR";
  return "USD";
}

export function detectBrowserLocale(): KashuLocaleCode {
  if (typeof navigator === "undefined") return "en";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const n = normalizeLocale(lang);
    if ((KASHU_LOCALE_CODES as readonly string[]).includes(n)) {
      return n as KashuLocaleCode;
    }
  }
  return "en";
}

export function detectBrowserMoneyPrefs(): { locale: KashuLocaleCode; currency: KashuCurrencyCode } {
  const raw = typeof navigator !== "undefined" ? navigator.language : "en";
  const locale = detectBrowserLocale();
  return { locale, currency: defaultCurrencyForLocale(raw) };
}

export function localeIsRtl(locale: string): boolean {
  return locale.startsWith("ar");
}

export function requestLocale(request?: Request | null): string | undefined {
  if (!request) return undefined;
  const header = request.headers.get("accept-language");
  if (!header) return undefined;
  const first = header.split(",")[0]?.trim();
  return first ? normalizeLocale(first) : undefined;
}
