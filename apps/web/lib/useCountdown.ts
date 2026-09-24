"use client";

import { useEffect, useState } from "react";

/**
 * A clock that re-renders every `intervalMs` (default 30s) — enough to
 * keep a "Starts in 2h 14m" label roughly live without a per-second
 * render cost. Used by Explore's game/room cards (see DECISIONS.md,
 * "Explore: a unified browse screen").
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "Starts in 2h 14m" / "Starts in 45m" / "Starting now" for a future dateISO. */
export function formatCountdown(dateISO: string, now: Date): string {
  const diffMs = new Date(dateISO).getTime() - now.getTime();
  if (diffMs <= 0) return "Starting now";
  const totalMinutes = Math.round(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m`;
}
