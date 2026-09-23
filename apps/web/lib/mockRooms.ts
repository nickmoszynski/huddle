"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Local-only room state for Phase 2's routing/UI shell.
 *
 * There's no Supabase Realtime (or Auth, or LiveKit) wired up yet — see
 * DECISIONS.md — so this can't actually sync a room across devices. It
 * exists so "Start a room" / "Join a room" / "Start watch party" lead
 * somewhere real instead of doing nothing, and so the room screen can be
 * built and iterated on against real room codes. Swap this out for
 * Supabase-backed rooms once that project exists (Phase 2 proper).
 */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I — easy to read aloud

function generateRoomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export interface MockRoom {
  code: string;
  hostName: string;
  gameLabel?: string;
  createdAt: string;
}

interface MockRoomState {
  guestName: string | null;
  rooms: Record<string, MockRoom>;
  setGuestName: (name: string) => void;
  createRoom: (params: { hostName: string; gameLabel?: string }) => string;
  ensureRoom: (code: string, guestName: string) => MockRoom;
}

export const useMockRoomStore = create<MockRoomState>()(
  persist(
    (set, get) => ({
      guestName: null,
      rooms: {},
      setGuestName: (name) => set({ guestName: name }),
      createRoom: ({ hostName, gameLabel }) => {
        let code = generateRoomCode();
        while (get().rooms[code]) {
          code = generateRoomCode();
        }
        const room: MockRoom = { code, hostName, gameLabel, createdAt: new Date().toISOString() };
        set((s) => ({ rooms: { ...s.rooms, [code]: room }, guestName: hostName }));
        return code;
      },
      ensureRoom: (code, guestName) => {
        const existing = get().rooms[code];
        if (existing) return existing;
        const room: MockRoom = { code, hostName: guestName, createdAt: new Date().toISOString() };
        set((s) => ({ rooms: { ...s.rooms, [code]: room }, guestName }));
        return room;
      },
    }),
    { name: "huddle-mock-rooms" }
  )
);
