"use client";

import * as React from "react";
import { cn } from "./cn";

const LEAGUE_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  nfl: { bg: "bg-ac-soft", fg: "text-ac", label: "NFL" },
  mlb: { bg: "bg-live/15", fg: "text-live", label: "MLB" },
  wwe: { bg: "bg-gold/15", fg: "text-gold", label: "WWE" },
};

export interface LeagueBadgeProps {
  league?: string | null;
  /** A real team/league logo, once one's been sourced or licensed — see
   * the component doc comment below. Falls back to the initials badge
   * when omitted, same pattern as Avatar's `src`. */
  logoSrc?: string;
  name?: string;
  size?: number;
  className?: string;
}

/**
 * A stand-in for a team/league logo — a colored initials badge, not a
 * real trademarked mark. Team and league logos are trademarked, so this
 * intentionally never pulls one from the web on its own (see
 * DECISIONS.md, "Explore: a unified browse screen"); once Mo sources or
 * licenses real logo images, pass them as `logoSrc` and this renders
 * that instead — every call site already just passes a `league` string,
 * so wiring real logos in later is a one-file change, not a redesign.
 */
export function LeagueBadge({ league, logoSrc, name, size = 44, className }: LeagueBadgeProps) {
  const key = (league ?? "").toLowerCase();
  const style = LEAGUE_STYLES[key] ?? { bg: "bg-s2", fg: "text-mu", label: (league ?? "?").slice(0, 3).toUpperCase() };
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-control font-ui font-extrabold uppercase",
        !logoSrc && style.bg,
        !logoSrc && style.fg,
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={name ?? style.label} className="h-full w-full object-cover" />
      ) : (
        style.label
      )}
    </span>
  );
}
