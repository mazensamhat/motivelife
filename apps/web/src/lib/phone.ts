/** Normalize to E.164-ish +XXXXXXXXXXX for storage and SMS. */
export function normalizePhoneNumber(country: string, raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const c = country.toUpperCase();
  if (c === "CA" || c === "US") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return digits.startsWith("+") ? `+${digits.replace(/^\+/, "")}` : `+${digits}`;
  }

  return null;
}

export function maskPhoneNumber(phone: string): string {
  if (phone.length < 6) return "••••";
  return `${phone.slice(0, 3)}••••${phone.slice(-2)}`;
}
