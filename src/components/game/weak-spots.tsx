"use client";

import { CrosshairIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { playNote } from "@/audio/play-note";
import { EmptyState } from "@/components/empty-state";
import { isDemoMode } from "@/components/game/audio-session";
import {
  beatTimes,
  comboOf,
  ScoreBar,
  toGems,
} from "@/components/game/game-parts";
import { NoteHighway } from "@/components/game/note-highway";
import { RunResults } from "@/components/game/results";
import { useGameRun } from "@/components/game/use-game-run";
import { HeatMap } from "@/components/heat-map";
import { Kbd } from "@/components/kbd";
import { STRING_COLORS } from "@/components/string-colors";
import { Button } from "@/components/ui/button";
import { useShortcuts } from "@/components/use-shortcuts";
import { KEYS } from "@/config/shortcuts";
import { levelSettings } from "@/game/difficulty";
import { generateChart } from "@/game/note-sets";
import { loadNoteStats, type NoteStats, weakSpots } from "@/game/note-stats";
import {
  type Position,
  positionKey,
  positionMidi,
  positionName,
} from "@/game/positions";
import { loadProgress } from "@/game/progress";
import { summarize } from "@/game/score";
import { onDataReplaced } from "@/game/storage-events";

/** Notes drilled in one weak-spots run, and how many to play. */
const SPOTS = 8;
const RUN_NOTES = 32;
const RUN_BPM = 70;

const hear = (position: Position) => playNote(positionMidi(position));

function SpotList({ spots, stats }: { spots: Position[]; stats: NoteStats }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {spots.map((position) => {
        const stat = stats[positionKey(position)];
        return (
          <li
            className="rounded-full border px-3 py-1"
            key={positionKey(position)}
          >
            <span
              className="font-semibold"
              style={{ color: STRING_COLORS[position.string] }}
            >
              {positionName(position).replace("#", "♯")}
            </span>{" "}
            <span className="text-muted-foreground">
              {position.string} {position.fret === 0 ? "open" : position.fret}
              {stat ? ` · ${Math.round(stat.mastery * 100)}%` : " · new"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Drills the notes you miss most, from the heat map. Until there's enough
 * history, it fills in with notes from your current level you haven't
 * played yet.
 */
export function WeakSpots() {
  const run = useGameRun();
  const [stats, setStats] = useState<NoteStats>({});
  const [fillFrom, setFillFrom] = useState<Position[]>([]);

  // Stats live in the browser, so read them after hydration, and again
  // whenever they're replaced from the account.
  useEffect(() => {
    const load = () => {
      setStats(loadNoteStats());
      setFillFrom(levelSettings(loadProgress().current).positions);
    };
    load();
    return onDataReplaced(load);
  }, []);

  const spots = useMemo(
    () => weakSpots(stats, fillFrom, SPOTS),
    [fillFrom, stats]
  );
  const { start } = run;
  const play = useCallback(
    () =>
      start({
        bpm: RUN_BPM,
        chart: generateChart(spots, { length: RUN_NOTES }),
        mode: "weak-spots",
        onFinish: () => setStats(loadNoteStats()),
      }),
    [spots, start]
  );

  const { feedback, getNow, judgments, notes, onFrame, phase, playing } = run;
  const summary = summarize(judgments, run.order);
  const activeLanes = useMemo(
    () => new Set(spots.map((position) => position.string)),
    [spots]
  );
  const canStart = !playing && phase !== "starting" && spots.length >= 2;
  useShortcuts({
    [KEYS.start]: canStart && play,
    [KEYS.stop]: playing && run.stop,
  });
  let buttonLabel = phase === "finished" ? "Drill them again" : "Start";
  if (playing) {
    buttonLabel = "Stop";
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {[
            `Your ${SPOTS} weakest notes`,
            `${RUN_NOTES} per run`,
            `${RUN_BPM} BPM`,
            "Names shown",
          ].map((fact) => (
            <li
              className="rounded-full border bg-card px-2.5 py-1 text-muted-foreground"
              key={fact}
            >
              {fact}
            </li>
          ))}
        </ul>
        {spots.length >= 2 ? (
          <SpotList spots={spots} stats={stats} />
        ) : (
          <EmptyState icon={CrosshairIcon} title="Nothing to drill yet">
            Play a few levels first. Every note you play shows which ones you
            know least.
          </EmptyState>
        )}
      </section>

      <NoteHighway
        activeLanes={activeLanes}
        beatTimesMs={beatTimes(notes, run.bpm)}
        combo={comboOf(summary)}
        feedback={feedback}
        gems={toGems(notes, judgments)}
        getNow={getNow}
        onFrame={onFrame}
      />
      <ScoreBar summary={summary} />
      <Button
        className="w-full"
        disabled={phase === "starting" || spots.length < 2}
        onClick={playing ? run.stop : play}
        size="lg"
        variant={playing ? "outline" : "stage"}
      >
        {buttonLabel}
        <Kbd>{playing ? "Esc" : "Space"}</Kbd>
      </Button>
      {phase === "error" ? (
        <p className="text-center text-destructive text-sm" role="alert">
          {run.error}
        </p>
      ) : null}
      {phase === "finished" ? (
        <RunResults
          demo={isDemoMode()}
          summary={summary}
          title="Drill complete"
          total={notes.length}
          unlocked={run.unlocked}
        />
      ) : null}

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:p-6">
        <h2 className="font-semibold">Your fretboard</h2>
        <p className="text-muted-foreground text-sm">
          How well you know each note, from everything you've played. Tap a note
          to hear it.
        </p>
        <HeatMap onTap={playing ? undefined : hear} stats={stats} />
      </section>
    </div>
  );
}
