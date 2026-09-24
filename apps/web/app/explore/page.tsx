"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Pill, Segmented, TabBar } from "@huddle/ui";
import { TAB_PATHS } from "@/lib/tabs";
import { createRoomUrlForGame } from "@/lib/createRoomUrl";
import type { ExploreGame, GamesResponse } from "@/app/api/games/route";

/**
 * Explore — browse by league (see DECISIONS.md, "Explore: browse by
 * league"). Two sections: the upcoming/live schedule across every league
 * Explore supports (tap one to start a room for it — same flow as Home's
 * "Tonight" card), and public watch parties other people have already
 * started (tap to join). No sign-in required for either — this stays as
 * frictionless as joining by code, just discovery instead.
 *
 * Adding a new league to the filter row is one line here plus a source
 * in api/games/route.ts — see that file's doc comment.
 */

const LEAGUE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "nfl", label: "NFL" },
  { value: "mlb", label: "MLB" },
  { value: "wwe", label: "WWE" },
];

interface PublicRoom {
  code: string;
  name: string;
  status: string;
  event: { homeName: string; awayName: string; startTimeISO: string; league?: string | null; title?: string | null };
}

async function fetchGames(league: string): Promise<GamesResponse> {
  const res = await fetch(`/api/games?league=${league}`);
  if (!res.ok) throw new Error("Could not load the schedule.");
  return res.json();
}

async function fetchPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch("/api/rooms/public");
  if (!res.ok) throw new Error("Could not load public rooms.");
  const data = await res.json();
  return data.rooms;
}

function formatGameTime(dateISO: string): string {
  const date = new Date(dateISO);
  const isToday = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    ...(isToday ? {} : { weekday: "short", month: "short", day: "numeric" }),
  }).format(date);
}

export default function ExplorePage() {
  const router = useRouter();
  const [league, setLeague] = useState("all");

  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ["games", league],
    queryFn: () => fetchGames(league),
    staleTime: 5 * 60 * 1000,
  });
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ["public-rooms"],
    queryFn: fetchPublicRooms,
    refetchInterval: 30000,
  });

  const games = gamesData?.games ?? [];

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-28 pt-14">
      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Explore</h1>
      <p className="mt-3 font-ui text-[15px] text-mu">Find a game and start the watch party, or join one already going.</p>

      <Segmented
        options={LEAGUE_OPTIONS}
        value={league}
        onChange={setLeague}
        className="mt-6 w-full justify-between"
      />

      <section className="mt-6">
        <h2 className="mb-3 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">Upcoming</h2>
        <div className="flex flex-col gap-3">
          {gamesLoading ? (
            <>
              <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
              <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
            </>
          ) : games.length > 0 ? (
            games.map((g: ExploreGame) => (
              <div key={`${g.league}-${g.id}`} className="rounded-tile border border-line bg-s1 p-4">
                <div className="flex items-center gap-2">
                  <Pill tone={g.state === "in" ? "live" : "neutral"}>{g.state === "in" ? "Live" : g.leagueLabel}</Pill>
                  {g.subtitle && <span className="font-ui text-[11px] text-mu2">{g.subtitle}</span>}
                </div>
                <p className="mt-2 font-ui text-[15px] font-semibold text-tx">{g.title}</p>
                <p className="font-ui text-[12px] text-mu">{g.detail || formatGameTime(g.dateISO)}</p>
                <Button
                  variant="primary"
                  fullWidth
                  className="mt-3 h-11"
                  onClick={() =>
                    router.push(
                      createRoomUrlForGame({
                        id: g.id,
                        league: g.league,
                        title: g.title,
                        homeAbbr: g.homeAbbr,
                        awayAbbr: g.awayAbbr,
                        homeName: g.homeName,
                        awayName: g.awayName,
                        dateISO: g.dateISO,
                      })
                    )
                  }
                >
                  Start watch party
                </Button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
              <p className="font-ui text-[13px] text-mu">Nothing scheduled right now.</p>
              <p className="font-ui text-[12px] text-mu2">Check back closer to game time.</p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="mb-3 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">Public watch parties</h2>
        <div className="flex flex-col gap-3">
          {roomsLoading ? (
            <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
          ) : rooms && rooms.length > 0 ? (
            rooms.map((r) => (
              <div key={r.code} className="rounded-tile border border-line bg-s1 p-4">
                <Pill tone={r.status === "live" ? "live" : "neutral"}>{r.status === "live" ? "Live" : "Waiting"}</Pill>
                <p className="mt-2 font-ui text-[15px] font-semibold text-tx">{r.name}</p>
                <p className="font-ui text-[12px] text-mu">{r.event.title ?? `${r.event.awayName} @ ${r.event.homeName}`}</p>
                <Button
                  variant="primary"
                  fullWidth
                  className="mt-3 h-11"
                  onClick={() => router.push(`/join?code=${r.code}`)}
                >
                  Join
                </Button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
              <p className="font-ui text-[13px] text-mu">No public watch parties right now.</p>
              <p className="font-ui text-[12px] text-mu2">Start one from a game above and toggle it public.</p>
            </div>
          )}
        </div>
      </section>

      <TabBar
        value="explore"
        onChange={(tab) => router.push(TAB_PATHS[tab])}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-phone"
      />
    </div>
  );
}
