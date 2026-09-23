"use client";

/** Tiny per-browser convenience: remember the name someone last typed, so
 * they don't retype it every time they create/join a room. Not the source
 * of truth for anything — that's the real `users`/`guest_sessions` rows in
 * the database now (see DECISIONS.md). Safe to fail silently. */

const KEY = "huddle-display-name";

export function getStoredDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, name);
  } catch {
    // Private browsing / storage disabled — not worth surfacing to the user.
  }
}
