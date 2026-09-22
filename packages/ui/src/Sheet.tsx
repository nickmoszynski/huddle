"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/** Bottom sheet — used for More menu, settings rows, add-bet, etc. */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-phone rounded-t-tile border-t border-line bg-s1 p-gutter pb-8",
              className
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-pill bg-line2" />
            {title && <h2 className="mb-3 font-display text-[22px] font-extrabold uppercase leading-none">{title}</h2>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
