"use client";

import { VideoTile, PickCard, BetTicket, Pill, MomentSavedCard, Leaderboard } from "@huddle/ui";
import { useState } from "react";

/**
 * /dev/states — every UI state side by side, matching the prototype's
 * States screen (handoff §3.10): friend joining, camera off, mic muted,
 * poor connection, waiting for game, game ended, prediction resolved, bet
 * won, bet lost. A dev-only route (not in the tab bar / route table).
 */
export default function DevStatesPage() {
  const [momentOpen, setMomentOpen] = useState(true);

  return (
    <div className="min-h-dvh px-gutter py-10">
      <h1 className="mb-8 font-display text-[34px] font-extrabold uppercase leading-none">States</h1>

      <Section title="Video tile states">
        <div className="grid grid-cols-2 gap-3">
          <VideoTile name="Nick" micOn camOn conn="good" speaking />
          <VideoTile name="Pete" micOn={false} camOn conn="good" />
          <VideoTile name="Dave" micOn camOn={false} conn="good" />
          <VideoTile name="Mike" micOn camOn conn="poor" />
          <VideoTile name="Sarah" micOn camOn conn="reconnecting" />
          <VideoTile name="Jake" micOn camOn conn="good" joining />
        </div>
      </Section>

      <Section title="Waiting for game">
        <EmptyState label="Waiting for kickoff" detail="The room opens 60 minutes before Bills vs Patriots." />
      </Section>

      <Section title="Game ended">
        <EmptyState label="Final: Bills 27, Patriots 24" detail="Recap is ready — tap to relive the best moments." accent />
      </Section>

      <Section title="Prediction — open vs. resolved">
        <div className="flex flex-col gap-3">
          <PickCard
            kind="choice"
            prompt="Who scores next?"
            totalVotes={342}
            voterAvatarNames={["Nick", "Pete", "Dave", "Mike"]}
            options={[
              { id: "1", label: "Josh Allen", pct: 42, selected: true },
              { id: "2", label: "James Cook", pct: 28 },
              { id: "3", label: "Dalton Kincaid", pct: 18 },
              { id: "4", label: "Other", pct: 12 },
            ]}
          />
          <PickCard
            kind="choice"
            prompt="Next score?"
            resolved
            resultOptionId="1"
            totalVotes={198}
            voterAvatarNames={["Nick", "Pete"]}
            options={[
              { id: "1", label: "Touchdown", pct: 67 },
              { id: "2", label: "Field goal", pct: 22 },
              { id: "3", label: "No score", pct: 11 },
            ]}
          />
        </div>
      </Section>

      <Section title="Bet won / lost">
        <div className="flex flex-col gap-3">
          <BetTicket title="Josh Allen Anytime TD" kind="single" odds="+110" status="won" />
          <BetTicket title="Pat's Team Total Over 24.5" kind="single" odds="-110" status="lost" />
          <BetTicket
            title="4 Leg Parlay"
            kind="parlay"
            odds="+650"
            status="live"
            legsHit={3}
            legsTotal={4}
            legs={[{ market: "Kincaid", line: 60, stat: "receiving yards", current: 54, status: "live" }]}
          />
        </div>
      </Section>

      <Section title="Moment saved card">
        <div className="relative h-40 rounded-tile bg-s2">
          <MomentSavedCard
            open={momentOpen}
            title="TOUCHDOWN REACTION · Nick + Pete + Dave + Mike · Q3 8:42"
            faceNames={["Nick", "Pete", "Dave", "Mike"]}
            onView={() => {}}
            onDismiss={() => setMomentOpen(false)}
          />
        </div>
      </Section>

      <Section title="Leaderboard">
        <Leaderboard
          title="The Boys — Season"
          rows={[
            { rank: 1, name: "Nick", points: 1840, streak: 7 },
            { rank: 2, name: "Pete", points: 1710 },
            { rank: 3, name: "Dave", points: 1520 },
            { rank: 4, name: "Mike", points: 1190 },
          ]}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ label, detail, accent }: { label: string; detail: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-tile border border-line bg-s1 px-6 py-10 text-center">
      <Pill tone={accent ? "accent" : "neutral"}>{accent ? "Final" : "Upcoming"}</Pill>
      <div className="mt-2 font-ui text-[15px] font-semibold text-tx">{label}</div>
      <div className="font-ui text-[13px] text-mu">{detail}</div>
    </div>
  );
}
