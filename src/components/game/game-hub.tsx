"use client";

import { useCallback, useState } from "react";
import { EarTraining } from "@/components/game/ear-training";
import { LevelGame } from "@/components/game/level-game";
import { WeakSpots } from "@/components/game/weak-spots";

const MODES = [
  {
    description:
      "Climb from Easy to Demon. Each level adds notes, speeds up and moves around the neck more.",
    id: "levels",
    label: "Levels",
  },
  {
    description:
      "Drills the notes you miss most, from your fretboard heat map.",
    id: "weak-spots",
    label: "Weak spots",
  },
  {
    description:
      "The game plays a note; find it on your bass by ear, with higher or lower hints.",
    id: "ear",
    label: "Ear training",
  },
] as const;

type ModeId = (typeof MODES)[number]["id"];

function ModeTab({
  id,
  label,
  onChoose,
  selected,
}: {
  id: ModeId;
  label: string;
  onChoose: (id: ModeId) => void;
  selected: boolean;
}) {
  const choose = useCallback(() => onChoose(id), [id, onChoose]);
  return (
    <button
      aria-selected={selected}
      className={`flex-1 border-b-2 px-2 py-2 font-semibold text-sm transition-colors ${
        selected
          ? "border-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      onClick={choose}
      role="tab"
      type="button"
    >
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
        <div className="flex border-b" role="tablist">
          {MODES.map((entry) => (
            <ModeTab
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
