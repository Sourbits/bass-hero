"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { playNote } from "@/audio/play-note";
import { describeAudioError } from "@/components/audio-errors";
import { Fretboard } from "@/components/fretboard";
import {
  type AudioSession,
  isDemoMode,
  startAudioSession,
} from "@/components/game/audio-session";
import { type HighwayGem, splitNoteName } from "@/components/game/draw-highway";
import {
  type HighwayFeedback,
  NoteHighway,
} from "@/components/game/note-highway";
import { STRING_COLORS } from "@/components/string-colors";
import { Button } from "@/components/ui/button";
import { type ScheduledNote, scheduleChart } from "@/game/chart";
import { demoPerformance } from "@/game/demo";
import {
  CUSTOM_SET_ID,
  generateChart,
  NOTE_SETS,
  type NoteSet,
} from "@/game/note-sets";
import {
  type Position,
  positionKey,
  positionMidi,
  STRINGS,
} from "@/game/positions";
import { loadPractice, savePractice } from "@/game/practice-setting";
import { type ScoreSummary, summarize } from "@/game/score";
import { loadTempo, saveTempo, TEMPO } from "@/game/tempo-setting";
import { detectPlayedNotes } from "@/onset/played-notes";
import { describeJudgment, describeOffset } from "@/timing/describe";
import { createJudge, type Judge, type Judgment } from "@/timing/judge";
import { loadLatencyOffset } from "@/timing/latency-setting";

/** Time from pressing Start to the first note's target, in ms. */
const LEAD_IN_MS = 3000;
/** How long to keep the screen running after the last note, in ms. */
const OUTRO_MS = 1500;

type Phase = "error" | "finished" | "idle" | "playing" | "starting";

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

function toGems(
  notes: ScheduledNote[],
  judgments: (Judgment | undefined)[]
): HighwayGem[] {
  return notes.map((note, index) => {
    const judgment = judgments[index];
    let state: HighwayGem["state"] = "upcoming";
    if (judgment) {
      state = judgment.rating === "miss" ? "missed" : "hit";
    }
    return {
      color: STRING_COLORS[note.string],
      key: String(index),
      lane: note.string,
      state,
      targetMs: note.targetMs,
      ...splitNoteName(note.name),
    };
  });
}

function beatTimes(notes: ScheduledNote[], bpm: number) {
  const [first] = notes;
  const last = notes.at(-1);
  if (!(first && last)) {
    return [];
  }
  const beatMs = 60_000 / bpm;
  const startMs = first.targetMs - first.beat * beatMs;
  return Array.from(
    { length: Math.floor(last.beat) + 2 },
    (_, beat) => startMs + beat * beatMs
  );
}

function toFeedback(
  judgment: Judgment,
  notes: ScheduledNote[]
): HighwayFeedback {
  const { detail, label } = describeJudgment(judgment);
  return {
    detail,
    key: `${judgment.index}-${judgment.rating}`,
    label,
    lane: notes[judgment.index]?.string ?? null,
    tone: judgment.rating,
  };
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-semibold text-xl tabular-nums sm:text-2xl">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

/** The test game: play notes as they come down the highway. */
export function PlayGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [bpm, setBpm] = useState(TEMPO.default);
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(0);
  const [demo, setDemo] = useState(false);
  const [notes, setNotes] = useState<ScheduledNote[]>([]);
  const [judgments, setJudgments] = useState<(Judgment | undefined)[]>([]);
  const [feedback, setFeedback] = useState<HighwayFeedback | null>(null);
  const [getNow, setGetNow] = useState<(() => number) | null>(null);
  const [setId, setSetId] = useState(NOTE_SETS[0]?.id ?? "");
  const [customKeys, setCustomKeys] = useState<Set<string>>(new Set());

  const sessionRef = useRef<AudioSession | null>(null);
  const judgeRef = useRef<Judge | null>(null);
  const notesRef = useRef<ScheduledNote[]>([]);
  const endsAtRef = useRef(0);
  /** How far the audio has been analyzed, on the game clock, in ms. */
  const analyzedMsRef = useRef(0);

  // Settings live in the browser, so read them after hydration.
  useEffect(() => {
    setBpm(loadTempo());
    setLatencyOffsetMs(loadLatencyOffset());
    setDemo(isDemoMode());
    const practice = loadPractice();
    setSetId(practice.setId);
    setCustomKeys(new Set(practice.customKeys));
  }, []);

  const noteSet =
    setId === CUSTOM_SET_ID
      ? customSet(customKeys)
      : (NOTE_SETS.find((set) => set.id === setId) ?? NOTE_SETS[0]);

  const stopAudio = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setGetNow(null);
    await session?.stop();
  }, []);

  useEffect(
    () => () => {
      stopAudio().catch(() => undefined);
    },
    [stopAudio]
  );

  const show = useCallback((judge: Judge, latest: Judgment) => {
    setJudgments(judge.judgments());
    setFeedback(toFeedback(latest, notesRef.current));
  }, []);

  const start = async () => {
    setPhase("starting");
    setError("");
    setJudgments([]);
    setFeedback(null);
    judgeRef.current = null;
    analyzedMsRef.current = 0;
    const demoMode = isDemoMode();

    try {
      const session = await startAudioSession({
        demo: demoMode,
        listen: (source) =>
          detectPlayedNotes(source, {
            onNote: ({ note, onsetMs }) => {
              const judge = judgeRef.current;
              const judgment = judge?.judgeHit({
                midi: note?.midi ?? null,
                onsetMs,
              });
              if (judge && judgment) {
                show(judge, judgment);
              }
            },
            onReading: ({ time }) => {
              analyzedMsRef.current = time * 1000;
            },
          }),
      });
      sessionRef.current = session;

      const chart =
        noteSet?.fixedChart ?? generateChart(noteSet?.positions ?? []);
      const scheduled = scheduleChart(chart, {
        bpm,
        startMs: session.clock.now() + LEAD_IN_MS,
      });
      notesRef.current = scheduled;
      // The demo plays with no latency, so it needs no calibration offset.
      judgeRef.current = createJudge(scheduled, {
        latencyOffsetMs: demoMode ? 0 : loadLatencyOffset(),
      });
      endsAtRef.current = (scheduled.at(-1)?.targetMs ?? 0) + OUTRO_MS;
      session.schedulePlucks?.(demoPerformance(scheduled));

      setNotes(scheduled);
      setGetNow(() => session.clock.now);
      setPhase("playing");
    } catch (startError) {
      await stopAudio();
      setError(describeAudioError(startError));
      setPhase("error");
    }
  };

  const onFrame = useCallback(
    (nowMs: number) => {
      const judge = judgeRef.current;
      if (!judge) {
        return;
      }
      // Only call a note unplayed once the audio after it has been analyzed.
      // If the page falls behind (a busy or background tab), plucks arrive
      // late, and going by the clock alone would miss notes that were played.
      const closed = judge.closeWindows(Math.min(nowMs, analyzedMsRef.current));
      const latest = closed.at(-1);
      if (latest) {
        show(judge, latest);
      }
      if (judge.isComplete() && nowMs > endsAtRef.current) {
        judgeRef.current = null;
        setPhase("finished");
        stopAudio().catch(() => undefined);
      }
    },
    [show, stopAudio]
  );

  const stop = async () => {
    judgeRef.current = null;
    await stopAudio();
    setPhase("idle");
    setFeedback(null);
  };

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

  const summary = summarize(judgments);
  const playing = phase === "playing" || phase === "starting";
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
        beatTimesMs={beatTimes(notes, bpm)}
        feedback={feedback}
        gems={toGems(notes, judgments)}
        getNow={getNow}
        onFrame={onFrame}
      />

      <div className="grid grid-cols-4 gap-2 rounded-2xl border p-4">
        <Stat label="Score" value={summary.score.toLocaleString("en-US")} />
        <Stat label="Perfect" value={summary.counts.perfect} />
        <Stat label="Good" value={summary.counts.good} />
        <Stat label="Miss" value={summary.counts.miss} />
      </div>

      {phase === "finished" ? (
        <RunSummary demo={demo} summary={summary} total={notes.length} />
      ) : null}

      <Button
        className="w-full"
        disabled={phase === "starting" || positions.length === 0}
        onClick={playing ? stop : start}
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

function statusText(phase: Phase, error: string, noteCount: number) {
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
        {summary.score.toLocaleString("en-US")}.
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
        highlighted={new Set(positions.map(positionKey))}
        onTap={onTap}
        tapMode={isCustom ? "toggle" : "hear"}
      />
    </section>
  );
}
