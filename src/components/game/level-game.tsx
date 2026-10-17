"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { playNote } from "@/audio/play-note";
import { Fretboard } from "@/components/fretboard";
import { isDemoMode } from "@/components/game/audio-session";
import { beatTimes, ScoreBar, toGems } from "@/components/game/game-parts";
import { NoteHighway } from "@/components/game/note-highway";
import {
  type FinishedRun,
  type RunPhase,
  useGameRun,
} from "@/components/game/use-game-run";
import { STRING_COLORS } from "@/components/string-colors";
import { Button } from "@/components/ui/button";
import {
  LEVELS_PER_TIER,
  TIER_ORDER,
  TIERS,
  type TierId,
} from "@/config/difficulty";
import { TIMING } from "@/config/timing";
import {
  generateLevelChart,
  type Level,
  levelSettings,
  starsFor,
  tierPositions,
} from "@/game/difficulty";
import { type Position, positionKey, positionMidi } from "@/game/positions";
import {
  type GameOptions,
  type LevelRecord,
  levelKey,
  loadProgress,
  NEW_PROGRESS,
  nextLevel,
  type Progress,
  recordRun,
  saveProgress,
} from "@/game/progress";
import { hitRate, type MissedNote, missedNotes } from "@/game/review";
import { type ScoreSummary, summarize } from "@/game/score";
import { describeOffset } from "@/timing/describe";
import type { MissReason } from "@/timing/judge";

const hear = (position: Position) => playNote(positionMidi(position));

const REASON_TEXT: Record<MissReason, string> = {
  buzz: "buzzed",
  early: "too early",
  late: "too late",
  "not-played": "not played",
  "wrong-note": "wrong note",
};

interface RunResult {
  hitRate: number;
  isBest: boolean;
  level: Level;
  missed: MissedNote[];
  stars: number;
  summary: ScoreSummary;
  total: number;
}

function starText(stars: number) {
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

function movementText(level: number) {
  if (level <= 2) {
    return "Neighboring notes";
  }
  if (level <= 5) {
    return "Short moves";
  }
  if (level <= 8) {
    return "Wider jumps";
  }
  return "Anywhere on the neck";
}

function TierButton({
  onChoose,
  selected,
  tier,
}: {
  onChoose: (tier: TierId) => void;
  selected: boolean;
  tier: TierId;
}) {
  const choose = useCallback(() => onChoose(tier), [onChoose, tier]);
  return (
    <button
      aria-pressed={selected}
      className={`flex-1 rounded-lg py-2 font-semibold transition-colors ${
        selected ? "bg-foreground text-background" : "hover:bg-muted"
      }`}
      onClick={choose}
      type="button"
    >
      {TIERS[tier].name}
    </button>
  );
}

function LevelButton({
  level,
  onChoose,
  record,
  selected,
}: {
  level: Level;
  onChoose: (level: Level) => void;
  record: LevelRecord | undefined;
  selected: boolean;
}) {
  const choose = useCallback(() => onChoose(level), [level, onChoose]);
  return (
    <button
      aria-label={`${TIERS[level.tier].name} level ${level.level}, ${record?.stars ?? 0} of 3 stars`}
      aria-pressed={selected}
      className={`flex flex-col items-center rounded-xl border py-1.5 transition-colors ${
        selected
          ? "border-foreground bg-foreground text-background"
          : "hover:bg-muted"
      }`}
      onClick={choose}
      type="button"
    >
      <span className="font-semibold">{level.level}</span>
      <span className="text-[0.65rem] text-amber-500 tracking-tight">
        {starText(record?.stars ?? 0)}
      </span>
    </button>
  );
}

function LevelPicker({
  disabled,
  onChoose,
  progress,
}: {
  disabled: boolean;
  onChoose: (level: Level) => void;
  progress: Progress;
}) {
  const { current } = progress;
  const settings = levelSettings(current);
  const chooseTier = useCallback(
    (tier: TierId) => onChoose({ level: 1, tier }),
    [onChoose]
  );

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="sr-only">Difficulty</legend>
      <div className="flex rounded-xl border p-1">
        {TIER_ORDER.map((tier) => (
          <TierButton
            key={tier}
            onChoose={chooseTier}
            selected={tier === current.tier}
            tier={tier}
          />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: LEVELS_PER_TIER }, (_, index) => {
          const level = { level: index + 1, tier: current.tier };
          return (
            <LevelButton
              key={level.level}
              level={level}
              onChoose={onChoose}
              record={progress.records[levelKey(level)]}
              selected={level.level === current.level}
            />
          );
        })}
      </div>
      <p className="text-muted-foreground text-sm">
        <span className="font-medium text-foreground">
          {TIERS[current.tier].name} {current.level}
        </span>{" "}
        · {movementText(current.level)} · {settings.bpm} BPM · {settings.notes}{" "}
        notes. {TIERS[current.tier].description}
      </p>
    </fieldset>
  );
}

function OptionToggle({
  checked,
  label,
  name,
  onToggle,
}: {
  checked: boolean;
  label: string;
  name: keyof GameOptions;
  onToggle: (name: keyof GameOptions, value: boolean) => void;
}) {
  const toggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onToggle(name, event.target.checked),
    [name, onToggle]
  );
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        checked={checked}
        className="mt-0.5 accent-foreground"
        onChange={toggle}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function MissedNoteRow({ missed }: { missed: MissedNote }) {
  const listen = useCallback(() => hear(missed.position), [missed.position]);
  const { fret, string } = missed.position;
  const reasons = missed.reasons
    .map((reason) => REASON_TEXT[reason])
    .join(", ");
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span>
        <span
          className="font-semibold"
          style={{ color: STRING_COLORS[string] }}
        >
          {missed.name.replace("#", "♯")}
        </span>{" "}
        <span className="text-muted-foreground text-sm">
          {string} string, {fret === 0 ? "open" : `fret ${fret}`} · missed{" "}
          {missed.count}× ({reasons})
        </span>
      </span>
      <Button onClick={listen} size="sm" variant="outline">
        Hear it
      </Button>
    </li>
  );
}

function MissedNotes({ missed }: { missed: MissedNote[] }) {
  if (missed.length === 0) {
    return (
      <p className="font-medium text-emerald-600">
        No notes missed. Clean run!
      </p>
    );
  }
  const frets = Math.max(5, ...missed.map((entry) => entry.position.fret));
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Notes to practice</h3>
      <p className="text-muted-foreground text-sm">
        Where they are, and how they sound. Tap one on the neck, or press Hear
        it.
      </p>
      <ul className="divide-y">
        {missed.map((entry) => (
          <MissedNoteRow key={positionKey(entry.position)} missed={entry} />
        ))}
      </ul>
      <Fretboard
        frets={frets}
        highlighted={
          new Set(missed.map((entry) => positionKey(entry.position)))
        }
        onTap={hear}
        tapMode="hear"
      />
    </div>
  );
}

function RunResultCard({
  demo,
  onNext,
  result,
}: {
  demo: boolean;
  onNext: (() => void) | null;
  result: RunResult;
}) {
  const { averageOffsetMs, counts, score } = result.summary;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-xl">
          {TIERS[result.level.tier].name} {result.level.level} complete
        </h2>
        <span className="text-2xl text-amber-500">
          {starText(result.stars)}
        </span>
      </div>
      <p>
        You hit {Math.round(result.hitRate * 100)}% of {result.total} notes:{" "}
        {counts.perfect} Perfect, {counts.good} Good, {counts.miss} Miss. Score{" "}
        {score.toLocaleString("en-US")}.
        {result.isBest ? " New best for this level!" : ""}
      </p>
      <p className="text-muted-foreground text-sm">
        {averageOffsetMs === null
          ? "No notes were hit."
          : `Your hits averaged ${describeOffset(averageOffsetMs)}.`}
        {demo ? " (Demo mode.)" : ""}
      </p>
      {onNext ? <Button onClick={onNext}>Next level</Button> : null}
      <MissedNotes missed={result.missed} />
    </section>
  );
}

function statusText(phase: RunPhase, error: string) {
  if (phase === "error") {
    return error;
  }
  return "Play each note as it reaches the ring in its lane. Clean notes only: buzzing counts as a miss.";
}

/**
 * The main game: pick a tier and a level, then play the notes coming down
 * the highway. Built to teach where every note is, and how it sounds.
 */
export function LevelGame() {
  const run = useGameRun();
  const [progress, setProgress] = useState<Progress>(NEW_PROGRESS);
  const [result, setResult] = useState<RunResult | null>(null);
  const [demo, setDemo] = useState(false);
  // Read when a run finishes, long after the render that started it.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Progress lives in the browser, so read it after hydration.
  useEffect(() => {
    setProgress(loadProgress());
    setDemo(isDemoMode());
  }, []);

  const update = useCallback((change: (previous: Progress) => Progress) => {
    const next = change(progressRef.current);
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
  }, []);

  const chooseLevel = useCallback(
    (level: Level) => {
      setResult(null);
      update((previous) => ({ ...previous, current: level }));
    },
    [update]
  );

  const setOption = useCallback(
    (name: keyof GameOptions, value: boolean) =>
      update((previous) => ({
        ...previous,
        options: { ...previous.options, [name]: value },
      })),
    [update]
  );

  const { start } = run;
  const startLevel = useCallback(
    (level: Level, choices: GameOptions) => {
      setResult(null);
      const settings = levelSettings(level);
      start({
        bpm: settings.bpm,
        chart: generateLevelChart(level),
        config: { ...TIMING, countBuzz: choices.countBuzz },
        guideTone: choices.guideTone,
        onFinish: ({ judgments: judged, notes: played }: FinishedRun) => {
          const rate = hitRate(judged, played.length);
          const summary = summarize(judged);
          const before = progressRef.current.records[levelKey(level)];
          setResult({
            hitRate: rate,
            isBest: !before || rate > before.bestHitRate,
            level,
            missed: missedNotes(played, judged),
            stars: starsFor(rate),
            summary,
            total: played.length,
          });
          update((previous) =>
            recordRun(previous, level, { hitRate: rate, score: summary.score })
          );
        },
      });
    },
    [start, update]
  );

  const { current, options } = progress;
  const upNext = nextLevel(current);
  const playCurrent = useCallback(
    () => startLevel(current, options),
    [current, options, startLevel]
  );
  const playNext = useCallback(() => {
    if (upNext) {
      chooseLevel(upNext);
      startLevel(upNext, options);
    }
  }, [chooseLevel, options, startLevel, upNext]);

  const settings = levelSettings(current);
  const { feedback, getNow, judgments, notes, onFrame, phase, playing } = run;
  const showMap = settings.showFretboard || options.showFretboardAlways;
  let buttonLabel = phase === "finished" ? "Play again" : "Start";
  if (playing) {
    buttonLabel = "Stop";
  }

  return (
    <div className="flex flex-col gap-6">
      <LevelPicker
        disabled={playing}
        onChoose={chooseLevel}
        progress={progress}
      />

      <NoteHighway
        activeLanes={new Set(TIERS[current.tier].strings)}
        beatTimesMs={beatTimes(notes, run.bpm)}
        feedback={feedback}
        gems={toGems(notes, judgments, { fretHints: settings.showFretHints })}
        getNow={getNow}
        onFrame={onFrame}
      />

      <ScoreBar summary={summarize(judgments)} />

      <Button
        className="w-full"
        disabled={phase === "starting"}
        onClick={playing ? run.stop : playCurrent}
        size="lg"
        variant={playing ? "outline" : "default"}
      >
        {buttonLabel}
      </Button>
      <p
        className={`text-center text-sm ${phase === "error" ? "text-destructive" : "text-muted-foreground"}`}
        role={phase === "error" ? "alert" : "status"}
      >
        {statusText(phase, run.error)}
      </p>

      {result && phase === "finished" ? (
        <RunResultCard
          demo={demo}
          onNext={upNext && result.level === current ? playNext : null}
          result={result}
        />
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border p-4 sm:p-6">
        <h2 className="font-semibold">Options</h2>
        <OptionToggle
          checked={options.countBuzz}
          label="Count fret buzz as a miss. Notes should ring clean; the tuner's buzz meter shows how yours measure."
          name="countBuzz"
          onToggle={setOption}
        />
        <OptionToggle
          checked={options.guideTone}
          label="Guide tone: hear each note as it reaches the ring, to learn how it sounds. Use headphones, or the mic will hear it too."
          name="guideTone"
          onToggle={setOption}
        />
        {settings.showFretboard ? null : (
          <OptionToggle
            checked={options.showFretboardAlways}
            label="Show the fretboard map on Hard (it's hidden so you play from memory)."
            name="showFretboardAlways"
            onToggle={setOption}
          />
        )}
      </section>

      {showMap ? (
        <section className="flex flex-col gap-3 rounded-2xl border p-4 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Notes in this tier</h2>
            <Link
              className="text-muted-foreground text-sm underline underline-offset-4"
              href="/notes"
            >
              Learn the notes
            </Link>
          </div>
          <p className="text-muted-foreground text-sm">
            Colored like their lanes. Tap one to hear it.
          </p>
          <Fretboard
            frets={Math.max(5, TIERS[current.tier].maxFret)}
            highlighted={new Set(tierPositions(current.tier).map(positionKey))}
            onTap={playing ? undefined : hear}
            tapMode="hear"
          />
        </section>
      ) : null}
    </div>
  );
}
