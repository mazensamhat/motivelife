export function getCalendarTimeZone() {
  return process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || "America/New_York";
}

/** Format an instant as local wall-clock time for Google Calendar API (no UTC suffix). */
export function formatGoogleCalendarDateTime(date: Date, timeZone = getCalendarTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  let hour = part("hour");
  if (hour === "24") hour = "00";

  return {
    dateTime: `${part("year")}-${part("month")}-${part("day")}T${hour}:${part("minute")}:${part("second")}`,
    timeZone,
  };
}
