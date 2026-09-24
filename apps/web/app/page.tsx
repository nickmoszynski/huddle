"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { brand } from "@huddle/brand";
import { Button, Pill, TabBar } from "@huddle/ui";
import { TAB_PATHS } from "@/lib/tabs";
import type { ScheduleGame, ScheduleResponse } from "./api/schedule/route";

/** Builds the /create URL, carrying the real game details along as query
 * params so the room that gets created there is tied to a real event
 * (see apps/web/app/api/rooms/route.ts). */
function createRoomUrlForGame(game: ScheduleGame): string {
  const params = new URLSearchParams({
    providerEventId: game.id,
    homeAbbr: game.homeAbbr,
    awayAbbr: game.awayAbbr,
    homeName: game.homeTeam,
    awayName: game.awayTeam,
    startTime: game.dateISO,
  });
  return `/create?${params.toString()}`;
}

/**
 * Home — hero, CTAs, tonight's event, crew strip, sign-off tagline
 * (handoff §3.1 / board 1 "1. HOME"). Start/Join/Start watch party route
 * into real, database-backed rooms; the TabBar now routes to real Groups,
 * Explore, and Profile pages too (see DECISIONS.md, "Groups/Explore/Profile").
 */

async function fetchSchedule(): Promise<ScheduleResponse> {
  const res = await fetch("/api/schedule");
  if (!res.ok) throw new Error("Failed to load schedule");
  return res.json();
}

export default function HomePage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: fetchSchedule,
    staleTime: 5 * 60 * 1000,
  });

  const game = data?.game ?? null;
  const gameLabel = game ? `${game.awayTeam} @ ${game.homeTeam}` : undefined;
  const isToday = game ? new Date(game.dateISO).toDateString() === new Date().toDateString() : false;
  const sectionLabel = isToday ? "Tonight" : "Next Up";
  const timeText = game
    ? `${new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
        ...(isToday ? {} : { weekday: "short", month: "short", day: "numeric" }),
      }).format(new Date(game.dateISO))} ET`
    : null;

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
            <span className="font-ui text-[12px] font-semibold text-ac">See all</span>
          </div>

          {isLoading ? (
            <div className="h-[140px] animate-pulse rounded-tile border border-line bg-s1" />
          ) : game ? (
            <div className="rounded-tile border border-line bg-s1 p-4">
              <Pill tone={game.state === "in" ? "live" : "neutral"}>{game.state === "in" ? "Live" : "NFL"}</Pill>
              <div className="mt-2 font-ui text-[15px] font-semibold text-tx">{gameLabel}</div>
              <div className="font-ui text-[12px] text-mu">{timeText}</div>
              <Button
                variant="primary"
                fullWidth
                className="mt-3 h-11"
                onClick={() => router.push(createRoomUrlForGame(game))}
              >
                Start watch party
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
              <Pill tone="neutral">No games scheduled</Pill>
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
