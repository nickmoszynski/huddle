"use client";

import * as React from "react";
import { Flame } from "lucide-react";
import { cn } from "./cn";
import { Avatar } from "./Avatar";

export interface LeaderboardRow {
  rank: number;
  name: string;
  points: number;
  streak?: number;
}

export interface LeaderboardProps {
  rows: LeaderboardRow[];
  title?: string;
  className?: string;
}

export function Leaderboard({ rows, title, className }: LeaderboardProps) {
  return (
    <div className={cn("rounded-tile border border-line bg-s1 p-4", className)}>
      {title && <h3 className="mb-3 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">{title}</h3>}
      <div className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={cn("w-4 text-center font-display text-[16px] font-extrabold", row.rank === 1 ? "text-gold" : "text-mu2")}>
              {row.rank}
            </span>
            <Avatar name={row.name} size={32} />
            <span className="flex-1 font-ui text-[14px] font-medium text-tx">{row.name}</span>
            {!!row.streak && (
              <span className="flex items-center gap-1 font-ui text-[12px] font-bold text-gold">
                <Flame size={12} /> {row.streak}
              </span>
            )}
            <span className="font-display text-[16px] font-extrabold font-tabular text-tx">{row.points.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
