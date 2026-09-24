"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { brand } from "@huddle/brand";
import { Button, TabBar } from "@huddle/ui";
import { TAB_PATHS } from "@/lib/tabs";
import { GameCard, type PublicRoom } from "@/components/GameCard";
import type { GamesResponse } from "./api/games/route";

/**
 * Home — hero, CTAs, tonight's event, crew strip, sign-off tagline
 * (handoff §3.1 / board 1 "1. HOME"). Start/Join/Start watch party route
 * into real, database-backed rooms; the TabBar now routes to real Groups,
 * Explore, and Profile pages too (see DECISIONS.md, "Groups/Explore/Profile").
 *
 * The "Tonight" card (see DECISIONS.md, "Home: join the same way Explore
 * does") used to always say "Start watch party," even when a public room
 * already existed for that exact game — the only way to find it was to
 * happen to check Explore instead. Now sources from `/api/games?league=nfl`
 * (the same feed Explore uses, in place of the old separate `/api/schedule`
 * — same "prefer in-progress, else soonest upcoming" pick, just done here
 * instead of server-side) and renders through the same shared `GameCard`
 * Explore uses, so if a public room already exists for tonight's game, a
 * Join button shows up right here too, not just on Explore.
 */

async function fetchNflGames(): Promise<GamesResponse> {
  const res = await fetch("/api/games?league=nfl");
  if (!res.ok) throw new Error("Failed to load schedule");
  return res.json();
}

async function fetchPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch("/api/rooms/public");
  if (!res.ok) throw new Error("Could not load public rooms.");
  const data = await res.json();
  return data.rooms;
}

export default function HomePage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["games", "nfl"],
    queryFn: fetchNflGames,
    staleTime: 5 * 60 * 1000,
  });
  const { data: rooms } = useQuery({
    queryKey: ["public-rooms"],
    queryFn: fetchPublicRooms,
    refetchInterval: 30000,
  });

  const games = data?.games ?? [];
  // Same pick /api/schedule used to make server-side: prefer a game in
  // progress, otherwise the soonest upcoming one (the list's already
  // sorted ascending by kickoff time, so the first "pre" game is it).
  const game = games.find((g) => g.state === "in") ?? games.find((g) => g.state === "pre") ?? null;
  const isToday = game ? new Date(game.dateISO).toDateString() === new Date().toDateString() : false;
  const sectionLabel = isToday ? "Tonight" : "Next Up";
  const gameRooms = game ? (rooms ?? []).filter((r) => r.event.providerEventId === game.id) : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 overflow-y-auto px-gutter pb-28 pt-14">
        <h1 className="font-display text-[52px] font-black uppercase leading-[0.88] text-tx">{brand.tagline}</h1>
        <p className="mt-3 font-ui text-[15px] text-mu">{brand.secondaryTagline}</p>

        <div className="mt-7 flex flex-col gap-3">
          <Button variant="primary" fullWidth onClick={() => router.push("/create")}>
            Start a room
          </Button>
          <Button variant="secondary" fullWidth onClick={() => router.push("/join")}>
            Join a room
          </Button>
        </div>

        <section className="mt-9">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">{sectionLabel}</h2>
            <button
              onClick={() => router.push("/explore")}
              className="font-ui text-[12px] font-semibold text-ac"
            >
              See all
            </button>
          </div>

          {isLoading ? (
            <div className="h-[140px] animate-pulse rounded-tile border border-line bg-s1" />
          ) : game ? (
            <GameCard game={game} rooms={gameRooms} />
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
              <p className="font-ui text-[13px] font-semibold text-mu">No games scheduled</p>
              <div className="mt-2 font-ui text-[13px] text-mu">Check back closer to kickoff.</div>
            </div>
          )}
        </section>

        <p className="mt-10 text-center font-ui text-[12px] font-medium uppercase tracking-[0.08em] text-mu2">
          {brand.signOff}
        </p>
      </main>

      <TabBar
        value="home"
        onChange={(tab) => router.push(TAB_PATHS[tab])}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-phone"
      />
    </div>
  );
}
