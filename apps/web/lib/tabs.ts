import type { BottomTab } from "@huddle/ui";

/** Maps a TabBar tab to its real route now that Groups/Explore/Profile exist (see DECISIONS.md). */
export const TAB_PATHS: Record<BottomTab, string> = {
  home: "/",
  groups: "/groups",
  explore: "/explore",
  profile: "/profile",
};
