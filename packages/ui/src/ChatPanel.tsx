"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "./cn";

/**
 * Purely presentational, same rule as VideoTile (handoff §4): no fetching,
 * no Realtime, no knowledge of `messages`/`room_participants` — the room
 * screen owns all of that and hands this component plain props.
 */
export interface ChatMessageItem {
  id: string;
  senderName: string;
  text: string;
  isMe: boolean;
  kind: "user" | "system" | "reaction" | string;
}

export interface ChatPanelProps {
  messages: ChatMessageItem[];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  className?: string;
  /** Height of the scrolling message list. Defaults to a fixed `h-64` (the
   * "chat as one section on a long page" size); pass something like
   * `flex-1` when ChatPanel is the whole content of its own tab/pane and
   * should fill the space it's given instead. */
  messagesClassName?: string;
}

export function ChatPanel({ messages, value, onChange, onSend, sending, className, messagesClassName }: ChatPanelProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() && !sending) onSend();
  }

  return (
    <div className={cn("flex flex-col rounded-tile border border-line bg-s1", className)}>
      <div ref={listRef} className={cn("flex flex-col gap-2 overflow-y-auto p-4", messagesClassName ?? "h-64")}>
        {messages.length === 0 ? (
          <p className="m-auto font-ui text-[13px] text-mu2">Say something to kick things off.</p>
        ) : (
          messages.map((m) =>
            m.kind === "system" ? (
              <p key={m.id} className="text-center font-ui text-[12px] text-mu2">
                {m.text}
              </p>
            ) : (
              <div key={m.id} className={cn("flex flex-col", m.isMe ? "items-end" : "items-start")}>
                {!m.isMe && <span className="mb-0.5 font-ui text-[11px] font-semibold text-mu">{m.senderName}</span>}
                <span
                  className={cn(
                    "max-w-[80%] rounded-tile px-3 py-2 font-ui text-[14px]",
                    m.isMe ? "bg-ac text-ac-ink" : "bg-s2 text-tx"
                  )}
                >
                  {m.text}
                </span>
              </div>
            )
          )
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Send a message"
          maxLength={1000}
          className="h-[44px] flex-1 rounded-control border border-line2 bg-s2 px-3 font-ui text-[14px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
        />
        <button
          type="submit"
          disabled={!value.trim() || sending}
          aria-label="Send message"
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-control bg-ac text-ac-ink transition-colors duration-fast ease-huddle disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
