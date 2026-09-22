"use client";

import * as React from "react";
import { Home, Users, Compass, User } from "lucide-react";
import { cn } from "./cn";

export type BottomTab = "home" | "groups" | "explore" | "profile";

const ITEMS: { value: BottomTab; label: string; Icon: typeof Home }[] = [
  { value: "home", label: "Home", Icon: Home },
  { value: "groups", label: "Groups", Icon: Users },
  { value: "explore", label: "Explore", Icon: Compass },
  { value: "profile", label: "Profile", Icon: User },
];

export interface TabBarProps {
  value: BottomTab;
  onChange: (tab: BottomTab) => void;
  className?: string;
}

/** Top-level screens only — rooms/replay/recap/sync/guest entry are full-screen (handoff §2). */
export function TabBar({ value, onChange, className }: TabBarProps) {
  return (
    <nav
      className={cn(
        "flex items-center justify-around border-t border-line bg-s1/95 px-2 pb-[max(theme(spacing.2),env(safe-area-inset-bottom))] pt-2 backdrop-blur",
        className
      )}
    >
      {ITEMS.map(({ value: v, label, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="flex min-w-[44px] flex-col items-center gap-1 py-1 font-ui text-[10px] font-semibold"
          >
            <Icon size={22} className={active ? "text-ac" : "text-mu2"} strokeWidth={active ? 2.4 : 2} />
            <span className={active ? "text-tx" : "text-mu2"}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
