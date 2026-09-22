"use client";

import * as React from "react";
import { cn } from "./cn";
import { LiveDot } from "./Pill";

export interface ScoreBugTeam {
  abbr: string;
  score: number;
  color: string; // team color, 3px marks only — never fills (handoff §5)
}

export interface ScoreBugProps {
  away: ScoreBugTeam;
  home: ScoreBugTeam;
  quarter: number;
  clock: string; // "8:42"
  syncOffsetSec?: number;
  onTapOffset?: () => void;
  live?: boolean;
  className?: string;
}

function quarterLabel(q: number) {
  if (q >= 5) return "OT";
  return `Q${q}`;
}

export function ScoreBug({ away, home, quarter, clock, syncOffsetSec, onTapOffset, live = true, className }: ScoreBugProps) {
  return (
    <div className={cn("flex items-center justify-between rounded-control border border-line bg-s1 px-4 py-3", className)}>
      <div className="flex items-center gap-2">
        <span className="h-[26px] w-[3px] rounded-full" style={{ backgroundColor: away.color }} />
        <span className="font-ui text-[13px] font-bold text-mu">{away.abbr}</span>
        <span className="font-display text-[26px] font-extrabold leading-none font-tabular">{away.score}</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        {live && <LiveDot />}
        <span className="font-ui text-[12px] font-semibold text-mu">
          {quarterLabel(quarter)} &middot; {clock}
        </span>
        {syncOffsetSec != null && (
          <button
            onClick={onTapOffset}
            className="rounded-pill bg-ac-soft px-2 py-0.5 font-ui text-[10px] font-bold text-ac"
          >
            +{syncOffsetSec.toFixed(1)}s
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="font-display text-[26px] font-extrabold leading-none font-tabular">{home.score}</span>
        <span className="font-ui text-[13px] font-bold text-mu">{home.abbr}</span>
        <span className="h-[26px] w-[3px] rounded-full" style={{ backgroundColor: home.color }} />
      </div>
    </div>
  );
}
