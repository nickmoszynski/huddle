"use client";

import * as React from "react";
import { Mic, MicOff, Video, VideoOff, WifiOff, Loader2 } from "lucide-react";
import { cn } from "./cn";
import { Avatar } from "./Avatar";

/**
 * Every video-tile state lives here via props — never a separate screen
 * (handoff §4 component hierarchy rule). Covers: joining, camera off,
 * muted, poor connection/reconnecting, speaking, spotlight sizing.
 */
export interface VideoTileProps {
  name: string;
  avatarSrc?: string;
  /**
   * A live video element (e.g. LiveKit's <VideoTrack />) to render instead
   * of the avatar/avatarSrc when `camOn` is true. Kept generic — this
   * primitive doesn't know or care that it's LiveKit specifically.
   */
  videoElement?: React.ReactNode;
  micOn: boolean;
  camOn: boolean;
  conn: "good" | "poor" | "reconnecting";
  speaking?: boolean;
  joining?: boolean;
  spotlight?: boolean;
  onTap?: () => void;
  className?: string;
}

export function VideoTile({
  name,
  avatarSrc,
  videoElement,
  micOn,
  camOn,
  conn,
  speaking,
  joining,
  spotlight,
  onTap,
  className,
}: VideoTileProps) {
  return (
    <button
      onClick={onTap}
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-tile bg-s2 transition-all duration-base ease-huddle",
        speaking && "ring-2 ring-ac",
        spotlight && "aspect-auto h-full",
        className
      )}
    >
      {camOn && !joining ? (
        videoElement ? (
          <div className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover">
            {videoElement}
          </div>
        ) : avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-s3 to-s1">
            <Avatar name={name} size={spotlight ? 96 : 56} />
          </div>
        )
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-s1">
          <Avatar name={name} size={spotlight ? 96 : 56} />
          {!joining && <VideoOff size={16} className="text-mu2" />}
        </div>
      )}

      {joining && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 size={22} className="animate-spin text-ac" />
        </div>
      )}

      {conn === "poor" && !joining && (
        <div className="absolute right-2 top-2 rounded-pill bg-black/60 px-2 py-1 font-ui text-[10px] font-bold text-live">
          Poor connection
        </div>
      )}
      {conn === "reconnecting" && !joining && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="flex items-center gap-1.5 font-ui text-[12px] font-semibold text-tx">
            <WifiOff size={14} /> Reconnecting&hellip;
          </span>
        </div>
      )}

      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
        <span className="rounded-pill bg-black/55 px-2 py-1 font-ui text-[12px] font-semibold text-tx">{name}</span>
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full",
            micOn ? "bg-black/40 text-tx" : "bg-live/90 text-white"
          )}
        >
          {micOn ? <Mic size={12} /> : <MicOff size={12} />}
        </span>
      </div>
    </button>
  );
}
