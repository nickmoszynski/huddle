"use client";

import { useState } from "react";
import { brand } from "@huddle/brand";
import { Button, Pill, TabBar, type BottomTab } from "@huddle/ui";

/**
 * Home — hero, CTAs, tonight's event, crew strip, sign-off tagline
 * (handoff §3.1 / board 1 "1. HOME"). Full routing (Sign in gate, Create,
 * Groups, Explore, Profile pages) lands in Phase 2; this proves the design
 * system end to end.
 */
export default function HomePage() {
  const [tab, setTab] = useState<BottomTab>("home");

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 overflow-y-auto px-gutter pb-28 pt-14">
        <h1 className="font-display text-[52px] font-black uppercase leading-[0.88] text-tx">
          {brand.tagline}
        </h1>
        <p className="mt-3 font-ui text-[15px] text-mu">{brand.secondaryTagline}</p>

        <div className="mt-7 flex flex-col gap-3">
          <Button variant="primary" fullWidth>
            Start a room
          </Button>
          <Button variant="secondary" fullWidth>
            Join a room
          </Button>
        </div>

        <section className="mt-9">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">Tonight</h2>
            <span className="font-ui text-[12px] font-semibold text-ac">See all</span>
          </div>
          <div className="rounded-tile border border-line bg-s1 p-4">
            <Pill tone="neutral">Monday Night Football</Pill>
            <div className="mt-2 font-ui text-[15px] font-semibold text-tx">Bills vs Patriots</div>
            <div className="font-ui text-[12px] text-mu">8:15 PM ET</div>
            <Button variant="primary" fullWidth className="mt-3 h-11">
              Start watch party
            </Button>
          </div>
        </section>

        <p className="mt-10 text-center font-ui text-[12px] font-medium uppercase tracking-[0.08em] text-mu2">
          {brand.signOff}
        </p>
      </main>

      <TabBar value={tab} onChange={setTab} className="fixed inset-x-0 bottom-0 mx-auto max-w-phone" />
    </div>
  );
}
