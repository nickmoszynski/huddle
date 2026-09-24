"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TabBar } from "@huddle/ui";
import { useSession } from "@/lib/session";
import { TAB_PATHS } from "@/lib/tabs";

/**
 * Groups — the crews you watch with regularly, distinct from a one-off
 * room code (see DECISIONS.md, "Groups/Explore/Profile"). Requires a
 * claimed username (`groups`/`group_members` reference `users`, not
 * `guest_sessions` — unlike rooms, groups were never designed for a guest
 * identity), so an unclaimed visitor sees a prompt to /signin instead of
 * the list below.
 */

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
}

async function fetchGroups(authUserId: string): Promise<GroupRow[]> {
  const res = await fetch(`/api/groups?authUserId=${authUserId}`);
  if (!res.ok) throw new Error("Could not load your groups.");
  const data = await res.json();
  return data.groups;
}

export default function GroupsPage() {
  const router = useRouter();
  const { authUserId, isSignedIn, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups", authUserId],
    queryFn: () => fetchGroups(authUserId as string),
    enabled: isSignedIn && !!authUserId,
  });

  async function handleCreate() {
    if (!name.trim() || !authUserId) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not create the group.");
      setName("");
      setMode("none");
      queryClient.invalidateQueries({ queryKey: ["groups", authUserId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !authUserId) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId, slug: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not join that group.");
      setJoinCode("");
      setMode("none");
      queryClient.invalidateQueries({ queryKey: ["groups", authUserId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-28 pt-14">
      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Groups</h1>

      {sessionLoading ? null : !isSignedIn ? (
        <div className="mt-8 rounded-tile border border-line bg-s1 p-4">
          <p className="font-ui text-[13px] text-mu">Claim a username to create or join a group with your crew.</p>
          <Button
            variant="primary"
            fullWidth
            className="mt-3 h-11"
            onClick={() => router.push("/signin?next=/groups")}
          >
            Claim a username
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setMode(mode === "create" ? "none" : "create")}>
              New group
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setMode(mode === "join" ? "none" : "join")}>
              Join by code
            </Button>
          </div>

          {mode === "create" && (
            <div className="mt-4 rounded-tile border border-line bg-s1 p-4">
              <label className="font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu" htmlFor="group-name">
                Group name
              </label>
              <input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sunday Crew"
                maxLength={40}
                className="mt-2 h-[48px] w-full rounded-control border border-line2 bg-s2 px-4 font-ui text-[15px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
              />
              <Button variant="primary" fullWidth className="mt-3 h-11" onClick={handleCreate} disabled={!name.trim() || working}>
                {working ? "Creating…" : "Create group"}
              </Button>
            </div>
          )}

          {mode === "join" && (
            <div className="mt-4 rounded-tile border border-line bg-s1 p-4">
              <label className="font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu" htmlFor="group-code">
                Group code
              </label>
              <input
                id="group-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="sunday-crew"
                maxLength={40}
                className="mt-2 h-[48px] w-full rounded-control border border-line2 bg-s2 px-4 font-ui text-[15px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
              />
              <Button variant="primary" fullWidth className="mt-3 h-11" onClick={handleJoin} disabled={!joinCode.trim() || working}>
                {working ? "Joining…" : "Join group"}
              </Button>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-control border border-live/30 bg-live/10 p-3 font-ui text-[13px] text-live">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {groupsLoading ? (
              <div className="h-[64px] animate-pulse rounded-tile border border-line bg-s1" />
            ) : groups && groups.length > 0 ? (
              groups.map((g) => (
                <div key={g.id} className="rounded-tile border border-line bg-s1 p-4">
                  <p className="font-ui text-[15px] font-semibold text-tx">{g.name}</p>
                  <p className="font-ui text-[12px] text-mu">
                    {g.memberCount} {g.memberCount === 1 ? "member" : "members"} · code: {g.slug}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
                <p className="font-ui text-[13px] text-mu">No groups yet — start one with "New group" above.</p>
              </div>
            )}
          </div>
        </>
      )}

      <TabBar
        value="groups"
        onChange={(tab) => router.push(TAB_PATHS[tab])}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-phone"
      />
    </div>
  );
}
