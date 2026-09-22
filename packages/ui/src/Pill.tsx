"use client";

import * as React from "react";
import { cn } from "./cn";

export type PillTone = "neutral" | "accent" | "live" | "gold";

export interface PillProps {
  children: React.ReactNode;
  tone?: PillTone;
  dot?: boolean;
  className?: string;
}

export function Pill({ children, tone = "neutral", dot, className }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 font-ui text-[11px] font-bold uppercase tracking-[0.08em]",
        tone === "neutral" && "bg-s2 text-mu",
        tone === "accent" && "bg-ac-soft text-ac",
        tone === "live" && "bg-live/15 text-live",
        tone === "gold" && "bg-gold/15 text-gold",
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "live" && "bg-live animate-pulse",
            tone === "accent" && "bg-ac",
            tone === "gold" && "bg-gold",
            tone === "neutral" && "bg-mu"
          )}
        />
      )}
      {children}
    </span>
  );
}

/** LIVE dot + label — the one place `live` red appears outside loss states. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <Pill tone="live" dot className={className}>
      Live
    </Pill>
  );
}
