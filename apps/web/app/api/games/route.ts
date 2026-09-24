import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getWweSchedule } from "@/lib/wweSchedule";

/**
 * Explore's multi-league schedule feed (see DECISIONS.md, "Explore:
 * browse by league"). Separate from /api/schedule (Home's single
 * "Tonight" NFL card) — this returns a browsable list across every
 * league Explore supports, not just the next NFL game.
 *
 * NFL and MLB both come from ESPN's free, unauthed scoreboard endpoint —
 * same one /api/schedule already uses for NFL, just generalized to also
 * hit baseball/mlb. ESPN's default (no `dates` param) scoreboard already
 * scopes to "this week" for both, and needs no special-casing for the
 * postseason — MLB's playoff games just start showing up in the same
 * feed once the regular season ends. WWE has no free public schedule API,
 * so it comes from the hand-maintained lib/wweSchedule.ts instead — see
 * that file's doc comment for how to add a new WWE event.
 *
 * Adding a new league later means adding one more ESPN_ENDPOINTS entry
 * (any other ESPN-covered sport — NBA, NHL, etc. — follows the identical
 * URL/response shape) or, for something without a free API, a new
 * hand-maintained module shaped like wweSchedule.ts.
 */

export const revalidate = 300; // 5 min, same as /api/schedule

const ESPN_ENDPOINTS = {
  nfl: { url: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", label: "NFL" },
  mlb: { url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard", label: "MLB" },
} as const;

type EspnLeague = keyof typeof ESPN_ENDPOINTS;

interface EspnCompetitor {
  homeAway: "home" | "away";
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
}

interface EspnEvent {
  id: string;
  date: string;
  status?: { type?: { state?: string; shortDetail?: string } };
  competitions?: Array<{ competitors?: EspnCompetitor[] }>;
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

export interface ExploreGame {
  id: string;
  league: string; // "nfl" | "mlb" | "wwe" | ...
  leagueLabel: string; // "NFL" | "MLB" | "WWE"
  title: string; // "Jets @ Bills" or "WWE Raw"
  subtitle: string; // "" for team sports; network/venue for something like WWE
  dateISO: string;
  state: string; // "pre" | "in" | "post"
  detail: string;
  homeAbbr: string;
  awayAbbr: string;
  homeName: string;
  awayName: string;
}

export interface GamesResponse {
  games: ExploreGame[];
  fetchedAt: string;
}

async function fetchEspnGames(league: EspnLeague): Promise<ExploreGame[]> {
  const { url, label } = ESPN_ENDPOINTS[league];
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`ESPN ${league} scoreboard responded ${res.status}`);
    const data: EspnScoreboardResponse = await res.json();
    const events = data.events ?? [];

    return events.map((e): ExploreGame => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      const homeName = home?.team?.shortDisplayName ?? home?.team?.displayName ?? "Home";
      const awayName = away?.team?.shortDisplayName ?? away?.team?.displayName ?? "Away";
      return {
        id: e.id,
        league,
        leagueLabel: label,
        title: `${awayName} @ ${homeName}`,
        subtitle: "",
        dateISO: e.date,
        state: e.status?.type?.state ?? "pre",
        detail: e.status?.type?.shortDetail ?? "",
        homeAbbr: home?.team?.abbreviation ?? "HOME",
        awayAbbr: away?.team?.abbreviation ?? "AWAY",
        homeName,
        awayName,
      };
    });
  } catch (err) {
    console.error(`[api/games] failed to fetch ${league} scoreboard`, err);
    return [];
  }
}

function wweGames(): ExploreGame[] {
  // WWE isn't a two-team matchup, so homeName/awayName (required by
  // /api/rooms' gameSchema) get the show title and network/venue instead
  // — /create shows `title` verbatim rather than "away @ home" whenever
  // it's set. See app/create/page.tsx and app/api/rooms/route.ts.
  return getWweSchedule().map((e) => ({
    id: e.id,
    league: "wwe",
    leagueLabel: "WWE",
    title: e.title,
    subtitle: e.subtitle,
    dateISO: e.dateISO,
    state: "pre",
    detail: "",
    homeAbbr: "WWE",
    awayAbbr: "WWE",
    homeName: e.title,
    awayName: e.subtitle,
  }));
}

export async function GET(req: NextRequest) {
  const leagueParam = req.nextUrl.searchParams.get("league"); // null/"all" = everything
  const wants = (l: string) => !leagueParam || leagueParam === "all" || leagueParam === l;

  const [nfl, mlb] = await Promise.all([
    wants("nfl") ? fetchEspnGames("nfl") : Promise.resolve<ExploreGame[]>([]),
    wants("mlb") ? fetchEspnGames("mlb") : Promise.resolve<ExploreGame[]>([]),
  ]);
  const wwe = wants("wwe") ? wweGames() : [];

  const games = [...nfl, ...mlb, ...wwe]
    .filter((g) => g.state !== "post")
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())
    .slice(0, 40);

  const body: GamesResponse = { games, fetchedAt: new Date().toISOString() };
  return NextResponse.json(body);
}
