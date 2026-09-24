"use client";

import { useRouter } from "next/navigation";
import { Button, LeagueBadge, Pill } from "@huddle/ui";
import { createRoomUrlForGame } from "@/lib/createRoomUrl";
import { formatCountdown, useNow } from "@/lib/useCountdown";
import type { ExploreGame } from "@/app/api/games/route";

/**
 * Shared by Home's "Tonight" card and Explore's game list (see
 * DECISIONS.md, "Home: join the same way Explore does") — previously each
 * screen had its own hand-rolled version of "show a game, and either a
 * public room already made for it or a button to start one," and they'd
 * quietly drifted apart: Explore already nested existing public rooms
 * under their game with a Join button, but Home always showed just "Start
 * watch party" regardless of whether a room already existed. One
 * component now, used both places, so that can't happen again.
 */

export interface PublicRoomEvent {
  providerEventId: string;
  homeName: string;
  awayName: string;
  startTimeISO: string;
  league?: string | null;
  title?: string | null;
}

export interface PublicRoom {
  code: string;
  /** The host's own name for the room — "Patriots Fans Only", "Northampton
   * Watch Party" — defaults to the game matchup if they didn't set one
   * (see DECISIONS.md, "Home: join the same way Explore does" and
   * app/create/page.tsx). This is what's shown as the room's title; the
   * game itself (via `event`) is the smaller line underneath. */
  name: string;
  status: string;
  watching: number;
  event: PublicRoomEvent;
}

/** A room actually has people in it right now — not the same thing as
 * `room.status === "live"` (see DECISIONS.md, "Fix: a game showed LIVE
 * hours before kickoff"). `rooms.status` gets set to "live" the moment a
 * room is created and, since nothing yet marks a room "ended" when
 * everyone leaves, effectively stays "live" forever — an empty room from
 * an hours-old test looks identical to one that's actually happening
 * right now if you go by status alone. `watching` (a live count of
 * current participants) is the only field that's actually true in the
 * present tense. */
export function roomIsActive(room: PublicRoom): boolean {
  return room.watching > 0;
}

export function isGameLive(game: ExploreGame, rooms: PublicRoom[]): boolean {
  return game.state === "in" || rooms.some(roomIsActive);
}

export function roomLabel(room: PublicRoom): string {
  return room.event.title ?? `${room.event.awayName} @ ${room.event.homeName}`;
}

export function RoomRow({ room, compact }: { room: PublicRoom; compact?: boolean }) {
  const router = useRouter();
  const active = roomIsActive(room);
  return (
    <div
      className={
        compact
          ? "flex items-center justify-between gap-3 rounded-control bg-s2 px-3 py-2.5"
          : "rounded-tile border border-line bg-s1 p-4"
      }
    >
      <div className={compact ? "min-w-0" : undefined}>
        <div className="flex items-center gap-2">
          <Pill tone={active ? "live" : "neutral"}>{active ? "Live" : "Waiting"}</Pill>
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

export function GameCard({ game, rooms }: { game: ExploreGame; rooms: PublicRoom[] }) {
  const router = useRouter();
  const now = useNow();
  const live = isGameLive(game, rooms);
  const countdown = live ? "Live" : formatCountdown(game.dateISO, now);

  function goCreate() {
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
    );
  }

  return (
    <div className="rounded-tile border border-line bg-s1 p-4">
      <div className="flex items-start gap-3">
        <LeagueBadge league={game.league} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Pill tone={live ? "live" : "neutral"}>{live ? "Live" : game.leagueLabel}</Pill>
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
          <Button variant="secondary" fullWidth className="mt-1 h-10" onClick={goCreate}>
            Start your own
          </Button>
        </div>
      ) : (
        <Button variant="primary" fullWidth className="mt-3 h-11" onClick={goCreate}>
          Start watch party
        </Button>
      )}
    </div>
  );
}
