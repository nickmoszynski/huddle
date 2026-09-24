"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Switch, TabBar } from "@huddle/ui";
import { signOutLocally } from "@/lib/supabaseClient";
import { useSession, useInvalidateSession } from "@/lib/session";
import { TAB_PATHS } from "@/lib/tabs";

/**
 * Profile — who you are (username + display name) and a handful of
 * settings (see DECISIONS.md, "Groups/Explore/Profile"). Requires a
 * claimed username, same gate as Groups. Settings are deliberately just
 * the three `user_prefs` columns that matter today (camOnJoin, micOnJoin,
 * notifyGameAlerts) — see api/auth/prefs's doc comment for the rest.
 */

interface Prefs {
  camOnJoin: boolean;
  micOnJoin: boolean;
  notifyGameAlerts: boolean;
}

async function fetchPrefs(authUserId: string): Promise<Prefs | null> {
  const res = await fetch(`/api/auth/prefs?authUserId=${authUserId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.prefs;
}

async function patchPrefs(authUserId: string, patch: Partial<Prefs>) {
  await fetch("/api/auth/prefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authUserId, ...patch }),
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const { authUserId, user, isSignedIn, isLoading: sessionLoading } = useSession();
  const invalidateSession = useInvalidateSession();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ["prefs", authUserId],
    queryFn: () => fetchPrefs(authUserId as string),
    enabled: isSignedIn && !!authUserId,
  });

  async function toggle(key: keyof Prefs, value: boolean) {
    if (!authUserId) return;
    queryClient.setQueryData(["prefs", authUserId], (prev: Prefs | null | undefined) =>
      prev ? { ...prev, [key]: value } : prev
    );
    await patchPrefs(authUserId, { [key]: value });
  }

  async function handleSignOut() {
    await signOutLocally();
    invalidateSession();
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-28 pt-14">
      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Profile</h1>

      {sessionLoading ? null : !isSignedIn ? (
        <div className="mt-8 rounded-tile border border-line bg-s1 p-4">
          <p className="font-ui text-[13px] text-mu">Claim a username to set up your profile.</p>
          <Button
            variant="primary"
            fullWidth
            className="mt-3 h-11"
            onClick={() => router.push("/signin?next=/profile")}
          >
            Claim a username
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3 rounded-tile border border-line bg-s1 p-4">
            <Avatar name={user?.displayName ?? "?"} size={52} />
            <div>
              <p className="font-ui text-[15px] font-semibold text-tx">{user?.displayName}</p>
              <p className="font-ui text-[13px] text-mu">@{user?.username}</p>
            </div>
          </div>

          <p className="mt-8 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">Room defaults</p>
          <div className="mt-3 flex flex-col divide-y divide-line rounded-tile border border-line bg-s1">
            <div className="flex items-center justify-between p-4">
              <span className="font-ui text-[15px] text-tx">Camera on when I join</span>
              <Switch checked={prefs?.camOnJoin ?? true} onChange={(v) => toggle("camOnJoin", v)} />
            </div>
            <div className="flex items-center justify-between p-4">
              <span className="font-ui text-[15px] text-tx">Mic on when I join</span>
              <Switch checked={prefs?.micOnJoin ?? true} onChange={(v) => toggle("micOnJoin", v)} />
            </div>
          </div>

          <p className="mt-6 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">Notifications</p>
          <div className="mt-3 rounded-tile border border-line bg-s1">
            <div className="flex items-center justify-between p-4">
              <span className="font-ui text-[15px] text-tx">Game alerts</span>
              <Switch checked={prefs?.notifyGameAlerts ?? true} onChange={(v) => toggle("notifyGameAlerts", v)} />
            </div>
          </div>

          <div className="mt-8 rounded-tile border border-line bg-s1 p-4">
            <p className="font-ui text-[13px] text-mu">
              No email on this account yet — if you clear your browser or switch phones, you'll lose access to @
              {user?.username} and your groups. Adding recovery is coming soon.
            </p>
          </div>

          <Button variant="danger" fullWidth className="mt-6" onClick={handleSignOut}>
            Sign out
          </Button>
        </>
      )}

      <TabBar
        value="profile"
        onChange={(tab) => router.push(TAB_PATHS[tab])}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-phone"
      />
    </div>
  );
}
