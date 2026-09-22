"use client";

import * as React from "react";
import { cn } from "./cn";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  online?: boolean;
  ring?: "none" | "speaking" | "live";
  className?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ name, src, size = 40, online, ring = "none", className }: AvatarProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-s3 font-ui font-semibold text-tx",
          ring === "speaking" && "ring-2 ring-ac ring-offset-2 ring-offset-bg",
          ring === "live" && "ring-2 ring-live ring-offset-2 ring-offset-bg"
        )}
        style={{ fontSize: size * 0.36 }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>
      {online && (
        <span
          className="absolute rounded-full bg-ac border-2 border-bg"
          style={{ width: size * 0.3, height: size * 0.3, right: -1, bottom: -1 }}
        />
      )}
    </span>
  );
}
