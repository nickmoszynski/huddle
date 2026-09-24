"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Pill, TabBar } from "@huddle/ui";
import { TAB_PATHS } from "@/lib/tabs";

/**
 * Explore — browse public rooms and tap in, no code needed (see
 * DECISIONS.md, "Groups/Explore/Profile"). No sign-in required: this is
 * as frictionless as joining by code, just discovery instead of needing
 * the code texted to you. Deliberately the simple version (see
 * api/rooms/public's doc comment) — no tags, no featured slots, no Q&A.
 */

interface PublicRoom {
  code: string;
  name: string;
  status: string;
  event: { homeName: string; awayName: string; startTimeISO: string };
}

async function fetchPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch("/api/rooms/public");
  if (!res.ok) throw new Error("Could not load public rooms.");
  const data = await res.json();
  return data.rooms;
}

export default function ExplorePage() {
  const router = useRouter();
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["public-rooms"],
    queryFn: fetchPublicRooms,
    refetchInterval: 30000,
  });

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-28 pt-14">
      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Explore</h1>
      <p className="mt-3 font-ui text-[15px] text-mu">Public watch parties happening right now.</p>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <>
            <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
            <div className="h-[92px] animate-pulse rounded-tile border border-line bg-s1" />
          </>
        ) : rooms && rooms.length > 0 ? (
          rooms.map((r) => (
            <div key={r.code} className="rounded-tile border border-line bg-s1 p-4">
              <Pill tone={r.status === "live" ? "live" : "neutral"}>{r.status === "live" ? "Live" : "Waiting"}</Pill>
              <p className="mt-2 font-ui text-[15px] font-semibold text-tx">{r.name}</p>
              <p className="font-ui text-[12px] text-mu">
                {r.event.awayName} @ {r.event.homeName}
              </p>
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
            <p className="font-ui text-[12px] text-mu2">Check back closer to kickoff, or start your own.</p>
          </div>
        )}
      </div>

      <TabBar
        value="explore"
        onChange={(tab) => router.push(TAB_PATHS[tab])}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-phone"
      />
    </div>
  );
}
