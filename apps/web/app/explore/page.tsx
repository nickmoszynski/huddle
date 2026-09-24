"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Segmented, TabBar } from "@huddle/ui";
import { TAB_PATHS } from "@/lib/tabs";
import { GameCard, RoomRow, isGameLive, roomIsActive, type PublicRoom } from "@/components/GameCard";
import type { GamesResponse } from "@/app/api/games/route";

/**
 * Explore — browse by league, live or upcoming (see DECISIONS.md,
 * "Explore: a unified browse screen"). Two tabs instead of two
 * disconnected sections: "Live Now" is public rooms actually happening;
 * "Upcoming" is the schedule, with any public room already made for a
 * game nested right under it (matched by the event's provider id) —
 * that's the answer to "how do people find a public room for this
 * game": it shows up attached to the game itself, not buried in a
 * separate flat list. A public room whose event isn't in the fetched
 * schedule window (an ad hoc watch party, or a game further out than
 * what's currently pulled) falls back to its own card under "Other
 * public rooms" so nothing gets lost.
 *
 * A game (with its nested rooms) is "live" — and appears ONLY under
 * Live Now, never both tabs — when ESPN says the broadcast is in
 * progress OR any room nested under it actually has someone in it right
 * now (see DECISIONS.md, "Fix: a game showed in both Live Now and
 * Upcoming", and its follow-up "Fix: a game showed LIVE hours before
 * kickoff"). That second check is `roomIsActive` (`watching > 0`), not
 * `room.status === "live"` — status gets set to "live" the instant a
 * room is created and never changes, so an empty room from an old test
 * would otherwise flag the whole game LIVE forever. The "someone's
 * actually in a room for it" half of the live check matters for WWE
 * especially, which has no live broadcast state of its own — a WWE game
 * card only moves to Live Now once someone's room for it actually has
 * people in it. Both tabs render through the same `GameCard`, so "Start
 * your own" shows up next to existing rooms in either tab, not just
 * Upcoming.
 *
 * `GameCard`/`RoomRow`/`isGameLive` moved out to `@/components/GameCard`
 * (see DECISIONS.md, "Home: join the same way Explore does") so Home's
 * "Tonight" card can render a game exactly the same way this screen does,
 * instead of the two screens quietly growing different rules for the same
 * thing.
 */

const LEAGUE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "nfl", label: "NFL" },
  { value: "mlb", label: "MLB" },
  { value: "wwe", label: "WWE" },
];

const DATE_OPTIONS: { value: "today" | "week" | "all"; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "all", label: "All" },
];

async function fetchGames(): Promise<GamesResponse> {
  const res = await fetch("/api/games?league=all");
  if (!res.ok) throw new Error("Could not load the schedule.");
  return res.json();
}

async function fetchPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch("/api/rooms/public");
  if (!res.ok) throw new Error("Could not load public rooms.");
  const data = await res.json();
  return data.rooms;
}

function isWithinDateScope(dateISO: string, scope: "today" | "week" | "all"): boolean {
  if (scope === "all") return true;
  const date = new Date(dateISO);
  const now = new Date();
  if (scope === "today") return date.toDateString() === now.toDateString();
  const graceMs = 3 * 60 * 60 * 1000; // keep something that started a few hours ago
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return date.getTime() >= now.getTime() - graceMs && date.getTime() <= now.getTime() + weekMs;
}

export default function ExplorePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"live" | "upcoming">("live");
  const [league, setLeague] = useState("all");
  const [dateScope, setDateScope] = useState<"today" | "week" | "all">("week");

  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ["games"],
    queryFn: fetchGames,
    staleTime: 5 * 60 * 1000,
  });
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ["public-rooms"],
    queryFn: fetchPublicRooms,
    refetchInterval: 30000,
  });

  const matchesLeague = (l?: string | null) => league === "all" || (l ?? "").toLowerCase() === league;

  const allGames = gamesData?.games ?? [];
  const allRooms = rooms ?? [];

  const roomsByEventId = useMemo(() => {
    const map = new Map<string, PublicRoom[]>();
    for (const r of allRooms) {
      const key = r.event.providerEventId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [allRooms]);

  // Every fetched game, league-filtered, split once into live vs.
  // upcoming so a game (and its nested rooms) shows under exactly one
  // tab — never both (see the file doc comment above).
  const leagueGames = allGames.filter((g) => matchesLeague(g.league));
  const liveGames = leagueGames.filter((g) => isGameLive(g, roomsByEventId.get(g.id) ?? []));
  const upcomingGames = leagueGames
    .filter((g) => !isGameLive(g, roomsByEventId.get(g.id) ?? []))
    .filter((g) => isWithinDateScope(g.dateISO, dateScope));

  // A public room whose event didn't come back from /api/games at all
  // (an ad hoc watch party, or a game further out than the fetched
  // window) has no game card to nest under — it falls back to its own
  // row, split the same way: live ones under Live Now, the rest under
  // Upcoming's "Other public rooms".
  const knownGameIds = new Set(leagueGames.map((g) => g.id));
  const liveOrphanRooms = allRooms.filter(
    (r) => roomIsActive(r) && !knownGameIds.has(r.event.providerEventId) && matchesLeague(r.event.league)
  );
  const otherRooms = allRooms.filter(
    (r) =>
      !roomIsActive(r) &&
      !knownGameIds.has(r.event.providerEventId) &&
      matchesLeague(r.event.league) &&
      isWithinDateScope(r.event.startTimeISO, dateScope)
  );

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-28 pt-14">
      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Explore</h1>
      <p className="mt-3 font-ui text-[15px] text-mu">Find a game and start the watch party, or join one already going.</p>

      <Segmented
        options={[
          { value: "live", label: "Live Now" },
          { value: "upcoming", label: "Upcoming" },
        ]}
        value={tab}
        onChange={setTab}
        className="mt-6 w-full justify-between"
      />
      <Segmented options={LEAGUE_OPTIONS} value={league} onChange={setLeague} className="mt-3 w-full justify-between" />
      {tab === "upcoming" && (
        <Segmented options={DATE_OPTIONS} value={dateScope} onChange={setDateScope} className="mt-3 w-full justify-between" />
      )}

      {tab === "live" ? (
        <section className="mt-6 flex flex-col gap-3">
          {gamesLoading || roomsLoading ? (
            <>
              <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
              <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
            </>
          ) : liveGames.length > 0 || liveOrphanRooms.length > 0 ? (
            <>
              {liveGames.map((g) => (
                <GameCard key={`${g.league}-${g.id}`} game={g} rooms={roomsByEventId.get(g.id) ?? []} />
              ))}
              {liveOrphanRooms.map((r) => (
                <RoomRow key={r.code} room={r} />
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
              <p className="font-ui text-[13px] text-mu">Nothing live right now.</p>
              <p className="font-ui text-[12px] text-mu2">Check Upcoming to start one.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="mt-6 flex flex-col gap-3">
            {gamesLoading ? (
              <>
                <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
                <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
              </>
            ) : upcomingGames.length > 0 ? (
              upcomingGames.map((g) => <GameCard key={`${g.league}-${g.id}`} game={g} rooms={roomsByEventId.get(g.id) ?? []} />)
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
                <p className="font-ui text-[13px] text-mu">Nothing scheduled right now.</p>
                <p className="font-ui text-[12px] text-mu2">Try a wider date range or a different league.</p>
              </div>
            )}
          </section>

          {otherRooms.length > 0 && (
            <section className="mt-9">
              <h2 className="mb-3 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">Other public rooms</h2>
              <div className="flex flex-col gap-3">
                {otherRooms.map((r) => (
                  <RoomRow key={r.code} room={r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <TabBar
        value="explore"
        onChange={(t) => router.push(TAB_PATHS[t])}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-phone"
      />
    </div>
  );
}
