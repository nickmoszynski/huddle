"use client";

import * as React from "react";
import { cn } from "./cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-pill bg-s1 p-1 border border-line", className)} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-pill px-4 font-ui text-[13px] font-semibold transition-colors duration-fast ease-huddle",
              active ? "bg-s3 text-tx" : "text-mu hover:text-tx"
            )}
          >
            {opt.label}
            {opt.count != null && (
              <span className={cn("rounded-pill px-1.5 text-[11px]", active ? "bg-ac-soft text-ac" : "bg-s2 text-mu2")}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
