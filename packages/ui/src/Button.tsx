"use client";

import * as React from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

/**
 * Primary CTA is the only place the accent green fills a surface
 * (handoff §5 — "ac — the only accent"). 52px primary height, 44px min
 * hit target everywhere else.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth, icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-control font-ui font-semibold text-[15px] transition-colors duration-fast ease-huddle disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]",
          "h-[52px] px-5 min-w-[44px]",
          fullWidth && "w-full",
          variant === "primary" && "bg-ac text-ac-ink hover:brightness-95",
          variant === "secondary" && "bg-s2 text-tx border border-line2 hover:bg-s3",
          variant === "ghost" && "bg-transparent text-tx hover:bg-s1",
          variant === "danger" && "bg-live/10 text-live border border-live/30 hover:bg-live/20",
          className
        )}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
