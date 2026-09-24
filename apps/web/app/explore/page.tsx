"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, LeagueBadge, Pill, Segmented, TabBar } from "@huddle/ui";
import { TAB_PATHS } from "@/lib/tabs";
import { createRoomUrlForGame } from "@/lib/createRoomUrl";
import { formatCountdown, useNow } from "@/lib/useCountdown";
import type { ExploreGame, GamesResponse } from "@/app/api/games/route";

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

interface PublicRoomEvent {
  providerEventId: string;
  homeName: string;
  awayName: string;
  startTimeISO: string;
  league?: string | null;
  title?: string | null;
}

interface PublicRoom {
  code: string;
  name: string;
  status: string;
  watching: number;
  event: PublicRoomEvent;
}

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

function roomLabel(room: PublicRoom): string {
  return room.event.title ?? `${room.event.awayName} @ ${room.event.homeName}`;
}

function RoomRow({ room, compact }: { room: PublicRoom; compact?: boolean }) {
  const router = useRouter();
  return (
    <div className={compact ? "flex items-center justify-between gap-3 rounded-control bg-s2 px-3 py-2.5" : "rounded-tile border border-line bg-s1 p-4"}>
      <div className={compact ? "min-w-0" : undefined}>
        <div className="flex items-center gap-2">
          <Pill tone={room.status === "live" ? "live" : "neutral"}>{room.status === "live" ? "Live" : "Waiting"}</Pill>
          {room.watching > 0 && <span className="font-ui text-[11px] text-mu2">{room.watching} watching</span>}
        </div>
        <p className="mt-1.5 truncate font-ui text-[14px] font-semibold text-tx">{room.name}</p>
        {!compact && <p className="font-ui text-[12px] text-mu">{roomLabel(room)}</p>}
      </div>
      <Button
        variant="primary"
        className={compact ? "h-9 shrink-0 px-4" : "mt-3 h-11 w-full"}
        onClick={() => router.push(`/join?code=${room.code}`)}
      >
        Join
      </Button>
    </div>
  );
}

function GameCard({ game, rooms }: { game: ExploreGame; rooms: PublicRoom[] }) {
  const router = useRouter();
  const now = useNow();
  const countdown = game.state === "in" ? "Live" : formatCountdown(game.dateISO, now);

  return (
    <div className="rounded-tile border border-line bg-s1 p-4">
      <div className="flex items-start gap-3">
        <LeagueBadge league={game.league} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Pill tone={game.state === "in" ? "live" : "neutral"}>{game.state === "in" ? "Live" : game.leagueLabel}</Pill>
          </div>
          <p className="mt-1.5 font-ui text-[15px] font-semibold text-tx">{game.title}</p>
          <p className="font-ui text-[12px] text-mu">
            {game.subtitle ? `${game.subtitle} · ` : ""}
            {game.detail || countdown}
          </p>
        </div>
      </div>

      {rooms.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {rooms.map((r) => (
            <RoomRow key={r.code} room={r} compact />
          ))}
          <Button
            variant="secondary"
            fullWidth
            className="mt-1 h-10"
            onClick={() =>
              router.push(
                createRoomUrlForGame({
                  id: game.id,
                  league: game.league,
                  title: game.title,
                  homeAbbr: game.homeAbbr,
                  awayAbbr: game.awayAbbr,
                  homeName: game.homeName,
                  awayName: game.awayName,
                  dateISO: game.dateISO,
                })
              )
            }
          >
            Start your own
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          fullWidth
          className="mt-3 h-11"
          onClick={() =>
            router.push(
              createRoomUrlForGame({
                id: game.id,
                league: game.league,
                title: game.title,
                homeAbbr: game.homeAbbr,
                awayAbbr: game.awayAbbr,
                homeName: game.homeName,
                awayName: game.awayName,
                dateISO: game.dateISO,
              })
            )
          }
        >
          Start watch party
        </Button>
      )}
    </div>
  );
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

  const liveRooms = allRooms.filter((r) => r.status === "live" && matchesLeague(r.event.league));

  const upcomingGames = allGames.filter((g) => matchesLeague(g.league) && isWithinDateScope(g.dateISO, dateScope));
  const shownGameIds = new Set(upcomingGames.map((g) => g.id));
  const otherRooms = allRooms.filter(
    (r) => r.status !== "live" && !shownGameIds.has(r.event.providerEventId) && matchesLeague(r.event.league) && isWithinDateScope(r.event.startTimeISO, dateScope)
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
          {roomsLoading ? (
            <>
              <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
              <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
            </>
          ) : liveRooms.length > 0 ? (
            liveRooms.map((r) => <RoomRow key={r.code} room={r} />)
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
