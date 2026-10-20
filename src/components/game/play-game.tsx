"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { playNote } from "@/audio/play-note";
import { Fretboard } from "@/components/fretboard";
import { isDemoMode } from "@/components/game/audio-session";
import {
  beatTimes,
  comboOf,
  ScoreBar,
  toGems,
} from "@/components/game/game-parts";
import { NoteHighway } from "@/components/game/note-highway";
import { type RunPhase, useGameRun } from "@/components/game/use-game-run";
import { Button } from "@/components/ui/button";
import {
  CUSTOM_SET_ID,
  generateChart,
  NOTE_SETS,
  type NoteSet,
} from "@/game/note-sets";
import { type Position, positionKey, positionMidi } from "@/game/positions";
import { loadPractice, savePractice } from "@/game/practice-setting";
import { type ScoreSummary, summarize } from "@/game/score";
import { onDataReplaced } from "@/game/storage-events";
import { loadTempo, saveTempo, TEMPO } from "@/game/tempo-setting";
import { STRINGS } from "@/instrument/bass";
import { describeOffset } from "@/timing/describe";
import { loadLatencyOffset } from "@/timing/latency-setting";

/** Every position up to the 12th fret, for the custom picker. */
const ALL_POSITIONS: Position[] = STRINGS.flatMap((string) =>
  Array.from({ length: 13 }, (_, fret) => ({ fret, string }))
);

function customSet(keys: Set<string>): NoteSet {
  return {
    description: "The notes you pick on the fretboard below.",
    id: CUSTOM_SET_ID,
    name: "Custom",
    positions: ALL_POSITIONS.filter((position) =>
      keys.has(positionKey(position))
    ),
  };
}

/** The test game: play notes as they come down the highway. */
export function PlayGame() {
  const run = useGameRun();
  const [bpm, setBpm] = useState(TEMPO.default);
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(0);
  const [demo, setDemo] = useState(false);
  const [setId, setSetId] = useState(NOTE_SETS[0]?.id ?? "");
  const [customKeys, setCustomKeys] = useState<Set<string>>(new Set());

  // Settings live in the browser, so read them after hydration, and again
  // whenever they're replaced from the account.
  useEffect(() => {
    setLatencyOffsetMs(loadLatencyOffset());
    setDemo(isDemoMode());
    const load = () => {
      setBpm(loadTempo());
      const practice = loadPractice();
      setSetId(practice.setId);
      setCustomKeys(new Set(practice.customKeys));
    };
    load();
    return onDataReplaced(load);
  }, []);

  const noteSet = useMemo(
    () =>
      setId === CUSTOM_SET_ID
        ? customSet(customKeys)
        : (NOTE_SETS.find((set) => set.id === setId) ?? NOTE_SETS[0]),
    [customKeys, setId]
  );

  const start = () =>
    run.start({
      bpm,
      chart: noteSet?.fixedChart ?? generateChart(noteSet?.positions ?? []),
    });

  const changeTempo = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setBpm(value);
      saveTempo(value);
    },
    []
  );

  const changeSet = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const id = event.target.value;
      setSetId(id);
      savePractice({ customKeys: [...customKeys], setId: id });
    },
    [customKeys]
  );

  const tapNote = useCallback(
    (position: Position) => {
      if (setId !== CUSTOM_SET_ID) {
        playNote(positionMidi(position));
        return;
      }
      const next = new Set(customKeys);
      const key = positionKey(position);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      setCustomKeys(next);
      savePractice({ customKeys: [...next], setId });
    },
    [customKeys, setId]
  );

  const { error, feedback, getNow, judgments, notes, onFrame, phase, playing } =
    run;
  const summary = summarize(judgments, run.order);
  const positions = noteSet?.positions ?? [];
  let buttonLabel = phase === "finished" ? "Play again" : "Start";
  if (playing) {
    buttonLabel = "Stop";
  }

  return (
    <div className="flex flex-col gap-6">
      <PlaySettings
        bpm={bpm}
        demo={demo}
        latencyOffsetMs={latencyOffsetMs}
        noteSet={noteSet}
        onChangeSet={changeSet}
        onChangeTempo={changeTempo}
        playing={playing}
        setId={setId}
      />

      <NoteHighway
        beatTimesMs={beatTimes(notes, run.bpm)}
        combo={comboOf(summary)}
        feedback={feedback}
        gems={toGems(notes, judgments)}
        getNow={getNow}
        onFrame={onFrame}
      />

      <ScoreBar summary={summary} />

      {phase === "finished" ? (
        <RunSummary demo={demo} summary={summary} total={notes.length} />
      ) : null}

      <Button
        className="w-full"
        disabled={phase === "starting" || positions.length === 0}
        onClick={playing ? run.stop : start}
        size="lg"
        variant={playing ? "outline" : "default"}
      >
        {buttonLabel}
      </Button>
      <p
        className={`text-center text-sm ${phase === "error" ? "text-destructive" : "text-muted-foreground"}`}
        role={phase === "error" ? "alert" : "status"}
      >
        {statusText(phase, error, positions.length)}
      </p>

      <NotesLegend
        isCustom={setId === CUSTOM_SET_ID}
        onTap={playing ? undefined : tapNote}
        positions={positions}
      />
    </div>
  );
}

function statusText(phase: RunPhase, error: string, noteCount: number) {
  if (phase === "error") {
    return error;
  }
  if (noteCount === 0) {
    return "Pick at least one note to play.";
  }
  return "Play each note as it reaches the ring in its lane.";
}

interface PlaySettingsProps {
  bpm: number;
  demo: boolean;
  latencyOffsetMs: number;
  noteSet: NoteSet | undefined;
  onChangeSet: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onChangeTempo: (event: React.ChangeEvent<HTMLInputElement>) => void;
  playing: boolean;
  setId: string;
}

/** Which notes to play, the tempo, and the calibration offset in use. */
function PlaySettings({
  bpm,
  demo,
  latencyOffsetMs,
  noteSet,
  onChangeSet,
  onChangeTempo,
  playing,
  setId,
}: PlaySettingsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Notes</span>
        <select
          className="h-9 rounded-lg border bg-background px-2"
          disabled={playing}
          onChange={onChangeSet}
          value={setId}
        >
          {NOTE_SETS.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
          <option value={CUSTOM_SET_ID}>Custom: pick your own</option>
        </select>
        <span className="text-muted-foreground">{noteSet?.description}</span>
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="flex justify-between">
          <span className="font-medium">Tempo</span>
          <span className="text-muted-foreground tabular-nums">{bpm} BPM</span>
        </span>
        <input
          className="h-9 accent-foreground"
          disabled={playing}
          max={TEMPO.max}
          min={TEMPO.min}
          onChange={onChangeTempo}
          step={TEMPO.step}
          type="range"
          value={bpm}
        />
        <span className="text-muted-foreground">
          {demo ? (
            "Demo mode: a synthesized bass plays, with no offset."
          ) : (
            <>
              Latency offset: {latencyOffsetMs} ms ·{" "}
              <Link className="underline underline-offset-4" href="/calibrate">
                Calibrate
              </Link>
            </>
          )}
        </span>
      </label>
    </div>
  );
}

function RunSummary({
  demo,
  summary,
  total,
}: {
  demo: boolean;
  summary: ScoreSummary;
  total: number;
}) {
  const average = summary.averageOffsetMs;
  const suggestCalibrating =
    !demo && average !== null && Math.abs(average) > 30;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border p-6">
      <h2 className="font-semibold text-xl">Run complete</h2>
      <p>
        {summary.counts.perfect} Perfect, {summary.counts.good} Good,{" "}
        {summary.counts.miss} Miss, out of {total} notes. Score{" "}
        {summary.score.toLocaleString("en-US")}. Longest streak{" "}
        {summary.maxStreak}
        {summary.fullCombo ? ": a full combo!" : "."}
      </p>
      <p className="text-muted-foreground">
        {average === null
          ? "No notes were hit, so there's no average timing."
          : `Average timing of your hits: ${describeOffset(average)}.`}
        {suggestCalibrating
          ? " If most hits lean the same way, try calibrating."
          : ""}
      </p>
    </section>
  );
}

/** The set's notes on the neck. For a custom set, tapping picks notes. */
function NotesLegend({
  isCustom,
  onTap,
  positions,
}: {
  isCustom: boolean;
  onTap: ((position: Position) => void) | undefined;
  positions: Position[];
}) {
  const frets = isCustom
    ? 12
    : Math.max(5, ...positions.map((position) => position.fret));
  const highlighted = useMemo(
    () => new Set(positions.map(positionKey)),
    [positions]
  );
  return (
    <section className="flex flex-col gap-3 rounded-2xl border p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          {isCustom ? "Pick your notes" : "Notes in this set"}
        </h2>
        <Link
          className="text-muted-foreground text-sm underline underline-offset-4"
          href="/notes"
        >
          Learn the notes
        </Link>
      </div>
      <p className="text-muted-foreground text-sm">
        {isCustom
          ? `Tap notes to add or remove them. ${positions.length} picked.`
          : "Where each note is on the neck, colored like its lane. Tap one to hear it."}
      </p>
      <Fretboard
        frets={frets}
        highlighted={highlighted}
        onTap={onTap}
        tapMode={isCustom ? "toggle" : "hear"}
      />
    </section>
  );
}
