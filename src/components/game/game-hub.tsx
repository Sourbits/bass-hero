"use client";

import { CrosshairIcon, EarIcon, LayersIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { EarTraining } from "@/components/game/ear-training";
import { LevelGame } from "@/components/game/level-game";
import { WeakSpots } from "@/components/game/weak-spots";

const MODES = [
  {
    description: "Climb from Easy to Demon, one level at a time.",
    icon: LayersIcon,
    id: "levels",
    label: "Levels",
  },
  {
    description: "Drill the notes you miss most.",
    icon: CrosshairIcon,
    id: "weak-spots",
    label: "Weak spots",
  },
  {
    description: "Hear a note, then find it on your bass.",
    icon: EarIcon,
    id: "ear",
    label: "Ear training",
  },
] as const;

type ModeId = (typeof MODES)[number]["id"];

function ModeTab({
  icon: Icon,
  id,
  label,
  onChoose,
  selected,
}: {
  icon: typeof LayersIcon;
  id: ModeId;
  label: string;
  onChoose: (id: ModeId) => void;
  selected: boolean;
}) {
  const choose = useCallback(() => onChoose(id), [id, onChoose]);
  return (
    <button
      aria-selected={selected}
      className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-1.5 py-2.5 font-bold font-heading text-sm transition-colors sm:text-base ${
        selected
          ? "bg-secondary text-foreground shadow-[inset_0_-2px_0_var(--gold)]"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
      onClick={choose}
      role="tab"
      type="button"
    >
      <Icon aria-hidden className="hidden size-4 shrink-0 sm:block" />
      {label}
    </button>
  );
}

/** The Game tab: three ways to learn the neck. */
export function GameHub() {
  const [mode, setMode] = useState<ModeId>("levels");
  const current = MODES.find((entry) => entry.id === mode) ?? MODES[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div
          className="flex gap-1 rounded-2xl border bg-card p-1"
          role="tablist"
        >
          {MODES.map((entry) => (
            <ModeTab
              icon={entry.icon}
              id={entry.id}
              key={entry.id}
              label={entry.label}
              onChoose={setMode}
              selected={entry.id === mode}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-sm">{current.description}</p>
      </div>
      <div role="tabpanel">
        {mode === "levels" ? <LevelGame /> : null}
        {mode === "weak-spots" ? <WeakSpots /> : null}
        {mode === "ear" ? <EarTraining /> : null}
      </div>
    </div>
  );
}
