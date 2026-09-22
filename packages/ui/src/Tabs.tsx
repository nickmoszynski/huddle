"use client";

import * as React from "react";
import { cn } from "./cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Room tabs: LIVE / CHAT / PICKS / BETS — always exactly these four. */
export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn("flex border-b border-line", className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 py-3 font-ui text-[13px] font-bold uppercase tracking-[0.06em] transition-colors duration-fast ease-huddle",
              active ? "text-tx" : "text-mu2 hover:text-mu"
            )}
          >
            {item.label}
            {!!item.badge && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-pill bg-ac px-1 text-[10px] font-bold text-ac-ink">
                {item.badge}
              </span>
            )}
            {active && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-ac" />}
          </button>
        );
      })}
    </div>
  );
}
