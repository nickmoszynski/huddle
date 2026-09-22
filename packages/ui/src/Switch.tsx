"use client";

import * as React from "react";
import { cn } from "./cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[30px] w-[50px] shrink-0 items-center rounded-pill transition-colors duration-fast ease-huddle disabled:opacity-40",
        checked ? "bg-ac" : "bg-s3",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-[24px] w-[24px] transform rounded-pill bg-tx shadow transition-transform duration-fast ease-huddle",
          checked ? "translate-x-[23px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}
