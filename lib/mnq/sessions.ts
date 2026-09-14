/**
 * CME trading hours and ICT killzones for MNQ, in Eastern Time.
 *
 * Everything here is expressed in ET wall-clock minutes because that is the
 * clock the setups are defined against: the London killzone is 02:00 ET in
 * January and 02:00 ET in July, even though those are different UTC hours.
 * Storing the windows in UTC and converting once would drift by an hour twice
 * a year and silently mis-tag every setup for the weeks around the changeover.
 *
 * ET parts are derived with Intl rather than a date library so DST is handled
 * by the platform's tzdata, which is kept current, instead of by us.
 */

export type SessionId = "asia" | "london" | "ny-am" | "ny-lunch" | "ny-pm" | "closed";

export interface SessionWindow {
  id: SessionId;
  label: string;
  /** Minutes from ET midnight, inclusive. */
  startMinute: number;
  /** Minutes from ET midnight, exclusive. */
  endMinute: number;
  /** ICT killzones are the windows where displacement is expected. Lunch and
   * the Asian range are context, not hunting grounds. */
  killzone: boolean;
  /** Tailwind colour token used by the session rail in the dashboard. */
  tone: "violet" | "emerald" | "amber" | "slate";
}

const H = (hour: number, minute = 0) => hour * 60 + minute;

/**
 * Windows are listed in ET clock order. Asia wraps past midnight, so it is
 * split rather than stored as a start > end range that every consumer would
 * have to special-case.
 */
export const SESSION_WINDOWS: SessionWindow[] = [
  { id: "asia", label: "Asia", startMinute: H(0), endMinute: H(2), killzone: false, tone: "slate" },
  { id: "london", label: "London KZ", startMinute: H(2), endMinute: H(5), killzone: true, tone: "violet" },
  { id: "ny-am", label: "NY AM KZ", startMinute: H(8, 30), endMinute: H(11), killzone: true, tone: "emerald" },
  { id: "ny-lunch", label: "NY Lunch", startMinute: H(12), endMinute: H(13), killzone: false, tone: "amber" },
  { id: "ny-pm", label: "NY PM KZ", startMinute: H(13, 30), endMinute: H(16), killzone: true, tone: "violet" },
  { id: "asia", label: "Asia", startMinute: H(20), endMinute: H(24), killzone: false, tone: "slate" },
];

/**
 * ICT "silver bullet" hours — the one-hour windows inside each killzone where
 * the algorithm is expected to deliver the day's cleanest displacement.
 * Named because the strategy in rayanbooooo/silver_bullet_bot keys off these.
 */
export const SILVER_BULLET_WINDOWS: { label: string; startMinute: number; endMinute: number }[] = [
  { label: "London SB", startMinute: H(3), endMinute: H(4) },
  { label: "NY AM SB", startMinute: H(10), endMinute: H(11) },
  { label: "NY PM SB", startMinute: H(14), endMinute: H(15) },
];

/** Regular trading hours — the cash equity session. */
export const RTH_OPEN_MINUTE = H(9, 30);
export const RTH_CLOSE_MINUTE = H(16);

/** CME halts MNQ 17:00–18:00 ET daily, and the week runs Sun 18:00 → Fri 17:00. */
export const DAILY_HALT_START_MINUTE = H(17);
export const DAILY_HALT_END_MINUTE = H(18);

const ET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface EtParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday, matching Date#getDay. */
  weekday: number;
  /** Minutes elapsed since ET midnight. */
  minuteOfDay: number;
  /** YYYY-MM-DD in ET. The key a trading day is bucketed under. */
  dateKey: string;
}

/** Decompose a UTC millisecond timestamp into Eastern Time parts. */
export function etParts(timestampMs: number): EtParts {
  const parts = ET_FORMATTER.formatToParts(new Date(timestampMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minuteOfDay: hour * 60 + minute,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Is MNQ tradeable at this instant? Covers the weekend and the daily halt. */
export function isMarketOpen(timestampMs: number): boolean {
  const { weekday, minuteOfDay } = etParts(timestampMs);

  // Saturday: closed all day.
  if (weekday === 6) return false;
  // Sunday: opens at 18:00 ET.
  if (weekday === 0) return minuteOfDay >= DAILY_HALT_END_MINUTE;
  // Friday: closes at 17:00 ET and does not reopen.
  if (weekday === 5) return minuteOfDay < DAILY_HALT_START_MINUTE;
  // Mon–Thu: open except the 17:00–18:00 maintenance hour.
  return minuteOfDay < DAILY_HALT_START_MINUTE || minuteOfDay >= DAILY_HALT_END_MINUTE;
}

/** Regular trading hours, i.e. 09:30–16:00 ET on a weekday. */
export function isRth(timestampMs: number): boolean {
  const { weekday, minuteOfDay } = etParts(timestampMs);
  if (weekday === 0 || weekday === 6) return false;
  return minuteOfDay >= RTH_OPEN_MINUTE && minuteOfDay < RTH_CLOSE_MINUTE;
}

/** The session window containing this instant, or "closed" outside all of them. */
export function sessionAt(timestampMs: number): SessionWindow | null {
  const { minuteOfDay } = etParts(timestampMs);
  return (
    SESSION_WINDOWS.find((w) => minuteOfDay >= w.startMinute && minuteOfDay < w.endMinute) ?? null
  );
}

/** True inside London / NY AM / NY PM — the windows setups are allowed to fire in. */
export function isKillzone(timestampMs: number): boolean {
  return sessionAt(timestampMs)?.killzone ?? false;
}

/** The silver-bullet hour containing this instant, if any. */
export function silverBulletAt(timestampMs: number): { label: string } | null {
  const { minuteOfDay } = etParts(timestampMs);
  return (
    SILVER_BULLET_WINDOWS.find((w) => minuteOfDay >= w.startMinute && minuteOfDay < w.endMinute) ??
    null
  );
}

/**
 * Minutes remaining until the prop firm's flat-by-close deadline.
 *
 * Negative once the deadline has passed. The dashboard turns this into the
 * countdown that stops new setups being taken: most futures prop accounts
 * auto-liquidate and count the breach against you rather than politely
 * declining the order.
 */
export function minutesUntilFlatten(timestampMs: number, flattenAtMinute: number): number {
  return flattenAtMinute - etParts(timestampMs).minuteOfDay;
}

/** Format ET minutes-of-day as HH:MM for labels. */
export function formatEtMinute(minuteOfDay: number): string {
  const wrapped = ((minuteOfDay % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Current ET wall clock as HH:MM:SS, for the dashboard header. */
export function formatEtClock(timestampMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestampMs));
}
