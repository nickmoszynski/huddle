"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";

export interface ToastProps {
  open: boolean;
  message: string;
  tone?: "default" | "success" | "error";
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** Falls back to this when a Moment fires outside the room (handoff §14). */
export function Toast({ open, message, tone = "default", action, className }: ToastProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            "fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-[400px] items-center justify-between gap-3 rounded-control border border-line2 bg-s2 px-4 py-3 shadow-lg",
            className
          )}
        >
          <span
            className={cn(
              "font-ui text-[14px] font-medium",
              tone === "success" && "text-ac",
              tone === "error" && "text-live",
              tone === "default" && "text-tx"
            )}
          >
            {message}
          </span>
          {action && (
            <button onClick={action.onClick} className="shrink-0 font-ui text-[13px] font-bold text-ac">
              {action.label}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
