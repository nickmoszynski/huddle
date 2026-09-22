"use client";

import * as React from "react";
import { cn } from "./cn";
import { Pill, LiveDot } from "./Pill";

export interface BetLegView {
  market: string;
  line: number;
  stat: string;
  current: number;
  status: "pending" | "live" | "won" | "lost" | "push";
}

export interface BetTicketProps {
  title: string;
  kind: "single" | "parlay";
  odds?: string;
  status: "pending" | "live" | "won" | "lost" | "push";
  legs?: BetLegView[];
  legsHit?: number;
  legsTotal?: number;
  className?: string;
}

function statusTone(status: BetTicketProps["status"]) {
  if (status === "won") return "accent" as const;
  if (status === "lost") return "live" as const;
  return "neutral" as const;
}

/** We don't take wagers — manual tracking only (handoff §1/§8). */
export function BetTicket({ title, kind, odds, status, legs = [], legsHit, legsTotal, className }: BetTicketProps) {
  const isLive = status === "live";
  return (
    <div className={cn("rounded-tile border border-line bg-s1 p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-ui text-[14px] font-semibold text-tx">{title}</div>
          {kind === "parlay" && legsTotal != null && (
            <div className="mt-0.5 font-ui text-[12px] text-mu">
              {legsHit}/{legsTotal} legs hit{legsHit === legsTotal ? "" : legsHit && legsTotal - legsHit === 1 ? " · 1 leg left" : ""}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {odds && <span className="font-ui text-[13px] font-bold text-tx">{odds}</span>}
          {isLive ? <LiveDot /> : <Pill tone={statusTone(status)}>{status}</Pill>}
        </div>
      </div>

      {legs.map((leg, i) => {
        const pct = Math.min(100, Math.round((leg.current / Math.max(leg.line, 1)) * 100));
        return (
          <div key={i} className="mt-3">
            <div className="flex items-center justify-between font-ui text-[12px] text-mu">
              <span>
                {leg.market} {leg.line}+ {leg.stat}
              </span>
              <span className="font-tabular text-tx">
                {leg.current}/{leg.line}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-s2">
              <div className="h-full rounded-pill bg-ac transition-all duration-base ease-huddle" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
