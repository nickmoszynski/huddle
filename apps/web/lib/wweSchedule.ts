/**
 * WWE's schedule for Explore (see DECISIONS.md, "Explore: browse by
 * league"). NFL and MLB have a free public schedule API (ESPN — see
 * app/api/games/route.ts); there's no equivalent for WWE, so this is a
 * small hand-maintained list instead.
 *
 * Two kinds of entries:
 *  - The two weekly shows (Raw, SmackDown) are generated a couple weeks
 *    out from their known broadcast night/network, so they never go
 *    stale on their own.
 *  - Premium Live Events (PPVs) are listed by hand in PREMIUM_LIVE_EVENTS
 *    below, confirmed against WWE's 2026 schedule as of 2026-09-24 (dates
 *    and cities; exact start times are estimates — update them once WWE
 *    announces the real kickoff time closer to the date). To add a new
 *    one (a newly-announced PPV, a special Raw location, etc.), just add
 *    another object to that array — no code changes, no migration, no
 *    redeploy of anything else. This is the extensibility Mo asked for:
 *    "be able to add more to entice more groups."
 */

interface WweWeeklyShow {
  id: string;
  title: string;
  network: string;
  weekdayUTC: number; // 0 = Sunday ... 6 = Saturday, the day this airs in the US
  hourET: number; // 24h local start hour, Eastern — see toUtcIso's note on precision
}

// Raw: Monday nights on Netflix. SmackDown: Friday nights, 8/7c, on USA
// Network. (NXT — Tuesdays on The CW — isn't included; Raw/SmackDown are
// the two shows most people would start a watch party for.)
const WEEKLY_SHOWS: WweWeeklyShow[] = [
  { id: "wwe-raw", title: "WWE Raw", network: "Netflix", weekdayUTC: 1, hourET: 20 },
  { id: "wwe-smackdown", title: "WWE SmackDown", network: "USA Network", weekdayUTC: 5, hourET: 20 },
];

interface WwePremiumLiveEvent {
  id: string;
  title: string;
  venue: string;
  dateISO: string;
}

const PREMIUM_LIVE_EVENTS: WwePremiumLiveEvent[] = [
  { id: "wwe-worlds-collide-2026", title: "WWE Worlds Collide", venue: "Chicago, IL", dateISO: "2026-09-26T19:00:00-05:00" },
  { id: "wwe-money-in-the-bank-2026", title: "WWE Money in the Bank", venue: "New Orleans, LA", dateISO: "2026-10-10T19:00:00-05:00" },
  { id: "wwe-crown-jewel-2026", title: "WWE Crown Jewel", venue: "Riyadh, Saudi Arabia", dateISO: "2026-11-07T13:00:00-05:00" },
  { id: "wwe-survivor-series-2026", title: "WWE Survivor Series: WarGames", venue: "Houston, TX", dateISO: "2026-11-28T19:00:00-06:00" },
  { id: "wwe-wrestlepalooza-2026", title: "WWE Wrestlepalooza", venue: "Perth, Australia", dateISO: "2026-12-12T19:00:00+11:00" },
];

export interface WweEvent {
  id: string;
  title: string;
  subtitle: string; // network for a weekly show, venue for a PLE
  dateISO: string;
}

/**
 * Builds a UTC instant for `hourET` Eastern on the given UTC-calendar
 * date, by adding a fixed 4-hour offset (EDT). `Date.UTC` normalizes an
 * hour past 23 into the next calendar day on its own, so this correctly
 * lands the instant just after midnight UTC for an 8pm ET show. This is
 * an approximation — once EST (UTC-5) kicks in for the season each fall,
 * generated weekly-show times will show about an hour early — acceptable
 * for a schedule display that mainly needs to get the *day* right.
 */
function toUtcIso(year: number, month: number, day: number, hourET: number): string {
  return new Date(Date.UTC(year, month, day, hourET + 4, 0, 0)).toISOString();
}

function nextWeeklyOccurrences(show: WweWeeklyShow, from: Date, count: number): WweEvent[] {
  const out: WweEvent[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let guard = 0;
  while (out.length < count && guard < 30) {
    guard++;
    if (cursor.getUTCDay() === show.weekdayUTC) {
      const dateISO = toUtcIso(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), show.hourET);
      // Keep today's show up for a few hours after it starts, same
      // grace window the premium-events filter below uses.
      if (new Date(dateISO).getTime() > from.getTime() - 3 * 60 * 60 * 1000) {
        out.push({
          id: `${show.id}-${cursor.toISOString().slice(0, 10)}`,
          title: show.title,
          subtitle: show.network,
          dateISO,
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** All upcoming WWE events (weekly shows + PLEs), soonest first. */
export function getWweSchedule(now: Date = new Date()): WweEvent[] {
  const weekly = WEEKLY_SHOWS.flatMap((show) => nextWeeklyOccurrences(show, now, 2));
  const premium = PREMIUM_LIVE_EVENTS.filter((e) => new Date(e.dateISO).getTime() > now.getTime() - 3 * 60 * 60 * 1000).map(
    (e): WweEvent => ({ id: e.id, title: e.title, subtitle: e.venue, dateISO: e.dateISO })
  );
  return [...weekly, ...premium].sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
}
