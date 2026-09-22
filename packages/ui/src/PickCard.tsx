"use client";

import * as React from "react";
import { Minus, Plus, Lock } from "lucide-react";
import { cn } from "./cn";
import { Avatar } from "./Avatar";
import { Pill } from "./Pill";
import { Button } from "./Button";

export interface ChoiceOption {
  id: string;
  label: string;
  pct: number; // 0-100, live split
  selected?: boolean;
}

export interface ChoicePickCardProps {
  kind: "choice";
  prompt: string;
  options: ChoiceOption[];
  totalVotes: number;
  voterAvatarNames?: string[];
  locked?: boolean;
  resolved?: boolean;
  resultOptionId?: string;
  onSelect?: (optionId: string) => void;
  className?: string;
}

export interface ScorePickCardProps {
  kind: "score";
  prompt: string; // "Final score?"
  away: { abbr: string; value: number };
  home: { abbr: string; value: number };
  locked?: boolean;
  onChange?: (team: "away" | "home", value: number) => void;
  onLock?: () => void;
  otherGuesses?: { name: string; text: string }[];
  className?: string;
}

export type PickCardProps = ChoicePickCardProps | ScorePickCardProps;

function CardShell({ prompt, locked, resolved, children }: { prompt: string; locked?: boolean; resolved?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-tile border border-line bg-s1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-tx">{prompt}</h3>
        {resolved ? (
          <Pill tone="accent">Resolved</Pill>
        ) : locked ? (
          <Pill tone="neutral">
            <Lock size={10} /> Locked
          </Pill>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function PickCard(props: PickCardProps) {
  if (props.kind === "choice") {
    const { prompt, options, totalVotes, voterAvatarNames = [], locked, resolved, resultOptionId, onSelect, className } = props;
    return (
      <div className={className}>
        <CardShell prompt={prompt} locked={locked} resolved={resolved}>
          <div className="flex flex-col gap-2">
            {options.map((opt) => {
              const isResult = resultOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  disabled={locked || resolved}
                  onClick={() => onSelect?.(opt.id)}
                  className="relative overflow-hidden rounded-control border border-line2 bg-s2 px-3 py-2.5 text-left disabled:cursor-default"
                >
                  <div
                    className={cn("absolute inset-y-0 left-0 transition-all duration-base ease-huddle", isResult || opt.selected ? "bg-ac-soft" : "bg-s3/60")}
                    style={{ width: `${opt.pct}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <span className="flex items-center gap-2 font-ui text-[14px] font-medium text-tx">
                      {opt.selected && <span className="h-2 w-2 rounded-full bg-ac" />}
                      {opt.label}
                    </span>
                    <span className={cn("font-ui text-[13px] font-bold", isResult ? "text-ac" : "text-mu")}>{opt.pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {voterAvatarNames.slice(0, 4).map((n) => (
                <Avatar key={n} name={n} size={20} className="ring-2 ring-s1" />
              ))}
            </div>
            <span className="font-ui text-[12px] text-mu2">{totalVotes} picks</span>
          </div>
        </CardShell>
      </div>
    );
  }

  const { prompt, away, home, locked, onChange, onLock, otherGuesses = [], className } = props;
  const stepper = (team: "away" | "home", label: string, value: number) => (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="font-ui text-[12px] font-bold text-mu">{label}</span>
      <div className="flex items-center gap-3">
        <button
          disabled={locked}
          onClick={() => onChange?.(team, Math.max(0, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-control bg-s2 text-tx disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <span className="w-10 text-center font-display text-[30px] font-extrabold font-tabular">{value}</span>
        <button
          disabled={locked}
          onClick={() => onChange?.(team, value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-control bg-s2 text-tx disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className={className}>
      <CardShell prompt={prompt} locked={locked}>
        <div className="flex items-center justify-center gap-4">
          {stepper("away", away.abbr, away.value)}
          <span className="font-display text-[20px] font-extrabold text-mu2">&ndash;</span>
          {stepper("home", home.abbr, home.value)}
        </div>
        {!locked && (
          <Button variant="primary" fullWidth className="mt-4 h-11" onClick={onLock}>
            Lock it in
          </Button>
        )}
        {otherGuesses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {otherGuesses.map((g, i) => (
              <span key={i} className="rounded-pill bg-s2 px-2 py-1 font-ui text-[11px] text-mu">
                {g.name}: {g.text}
              </span>
            ))}
          </div>
        )}
      </CardShell>
    </div>
  );
}
