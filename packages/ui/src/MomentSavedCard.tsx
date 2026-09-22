"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";
import { Button } from "./Button";

export interface MomentSavedCardProps {
  open: boolean;
  title: string; // e.g. "TOUCHDOWN REACTION · Nick + Pete + Dave + Mike · Q3 8:42"
  faceNames: string[];
  onView: () => void;
  onDismiss: () => void;
}

/**
 * Slides up over the bottom of the video grid — never a modal, the game and
 * friends stay visible (handoff §3.5 / §17). Auto-hides ~10s; caller owns
 * the timer via `open`.
 */
export function MomentSavedCard({ open, title, faceNames, onView, onDismiss }: MomentSavedCardProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-tile border border-line2 bg-s1/95 p-3 shadow-xl backdrop-blur"
        >
          <div className="flex -space-x-3">
            {faceNames.slice(0, 4).map((n) => (
              <Avatar key={n} name={n} size={36} className="ring-2 ring-s1" />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-ui text-[11px] font-bold uppercase tracking-[0.06em] text-ac">Moment Saved</div>
            <div className="truncate font-ui text-[13px] font-medium text-tx">{title}</div>
          </div>
          <Button variant="secondary" className="h-9 px-3 text-[12px]" onClick={onView}>
            View
          </Button>
          <button onClick={onDismiss} aria-label="Dismiss" className="text-mu2 hover:text-tx">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
