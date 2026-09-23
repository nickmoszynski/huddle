/**
 * Today's NFL schedule for the Home "Tonight" card — real games/times, not
 * live stats. This is deliberately separate from the FEED_PROVIDER system
 * in packages/shared (which needs a paid SportsDataIO/Sportradar license,
 * see DECISIONS.md): ESPN's public scoreboard endpoint is free, unauthed,
 * and only used here for schedule display, never for in-room live
 * scoring/moment detection.
 */

export const revalidate = 300; // 5 min — schedule data doesn't need to be fresher than that

const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

interface EspnCompetitor {
  homeAway: "home" | "away";
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
}

interface EspnEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status?: { type?: { state?: string; shortDetail?: string } };
  competitions?: Array<{ competitors?: EspnCompetitor[] }>;
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

export interface ScheduleGame {
  id: string;
  name: string;
  shortName: string;
  dateISO: string;
  state: string; // "pre" | "in" | "post"
  detail: string;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
}

export interface ScheduleResponse {
  game: ScheduleGame | null;
  fetchedAt: string;
  error?: boolean;
}

export async function GET() {
  try {
    const res = await fetch(ESPN_SCOREBOARD_URL, { next: { revalidate: 300 } });
    if (!res.ok) {
      throw new Error(`ESPN scoreboard responded ${res.status}`);
    }
    const data: EspnScoreboardResponse = await res.json();
    const events = data.events ?? [];

    const games: ScheduleGame[] = events.map((e) => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      return {
        id: e.id,
        name: e.name,
        shortName: e.shortName,
        dateISO: e.date,
        state: e.status?.type?.state ?? "pre",
        detail: e.status?.type?.shortDetail ?? "",
        homeTeam: home?.team?.shortDisplayName ?? home?.team?.displayName ?? "Home",
        awayTeam: away?.team?.shortDisplayName ?? away?.team?.displayName ?? "Away",
        homeAbbr: home?.team?.abbreviation ?? "HOME",
        awayAbbr: away?.team?.abbreviation ?? "AWAY",
      };
    });

    // Prefer a game in progress; otherwise the soonest upcoming one. ESPN's
    // default (no date param) scoreboard already scopes to "this week", so
    // on a game day this is today's game, and mid-week it's the next one.
    const inProgress = games.find((g) => g.state === "in");
    const upcoming = games
      .filter((g) => g.state === "pre")
      .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())[0];

    const game = inProgress ?? upcoming ?? null;

    const body: ScheduleResponse = { game, fetchedAt: new Date().toISOString() };
    return Response.json(body);
  } catch (err) {
    console.error("[api/schedule] failed to fetch NFL scoreboard", err);
    const body: ScheduleResponse = { game: null, fetchedAt: new Date().toISOString(), error: true };
    return Response.json(body);
  }
}
