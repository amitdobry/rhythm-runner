/**
 * Which week a run belongs to.
 *
 * The week runs Sunday to Sunday **in Israel**, because that is where the
 * children are: a run at 23:59 on Saturday night belongs to the week that is
 * ending, and one at 00:01 on Sunday starts the new one - even though both are
 * the same UTC day. Asking the server's own clock would get this wrong for
 * half of every Saturday evening, since the server runs in UTC.
 *
 * No library: Intl already knows the offset, daylight saving included.
 */

const ZONE = 'Asia/Jerusalem';

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Israeli calendar date and weekday at a moment in time. */
function jerusalem(date: Date): { ymd: string; weekday: number } {
  const parts = PARTS.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  };
}

/**
 * The key of the week a moment falls in: the YYYY-MM-DD of its Sunday,
 * as the date reads in Israel.
 */
export function weekKeyFor(date: Date): string {
  const here = jerusalem(date);
  if (here.weekday === 0) return here.ymd;

  // Step back a day at a time until Israel says Sunday. At most six steps, and
  // stepping in whole days never trips over a daylight saving change because
  // the weekday is read in the zone each time.
  let walk = date;
  for (let back = 0; back < 7; back += 1) {
    walk = new Date(walk.getTime() - DAY_MS);
    const day = jerusalem(walk);
    if (day.weekday === 0) return day.ymd;
  }
  return here.ymd; // unreachable
}

/** The Sunday that ends the week this key starts. */
export function weekEndFor(key: string): string {
  // Midday keeps the arithmetic clear of any midnight and any offset change.
  const start = new Date(`${key}T12:00:00Z`);
  const next = new Date(start.getTime() + 7 * DAY_MS);
  return jerusalem(next).ymd;
}
