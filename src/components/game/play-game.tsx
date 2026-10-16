"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeAudioError } from "@/components/audio-errors";
import {
  type AudioSession,
  isDemoMode,
  startAudioSession,
} from "@/components/game/audio-session";
import {
  Highway,
  type HighwayFeedback,
  type HighwayNote,
} from "@/components/game/highway";
import { Button } from "@/components/ui/button";
import { type ScheduledNote, scheduleChart, stringFor } from "@/game/chart";
import { WARM_UP } from "@/game/charts";
import { demoPerformance } from "@/game/demo";
import { summarize } from "@/game/score";
import { loadTempo, saveTempo, TEMPO } from "@/game/tempo-setting";
import { detectPlayedNotes } from "@/onset/played-notes";
import { describeJudgment, describeOffset } from "@/timing/describe";
import { createJudge, type Judge, type Judgment } from "@/timing/judge";
import { loadLatencyOffset } from "@/timing/latency-setting";

/** Time from pressing Start to the first note's target, in ms. */
const LEAD_IN_MS = 3000;
/** How long to keep the screen running after the last note, in ms. */
const OUTRO_MS = 1500;

const STRING_COLORS = {
  A: "#d97706",
  D: "#059669",
  E: "#e11d48",
  G: "#2563eb",
};

type Phase = "error" | "finished" | "idle" | "playing" | "starting";

function toHighwayNotes(
  notes: ScheduledNote[],
  judgments: (Judgment | undefined)[]
): HighwayNote[] {
  return notes.map((note, index) => {
    const judgment = judgments[index];
    let state: HighwayNote["state"] = "upcoming";
    if (judgment) {
      state = judgment.rating === "miss" ? "missed" : "hit";
    }
    return {
      color: STRING_COLORS[stringFor(note.midi)],
      key: String(index),
      label: note.name,
      state,
      targetMs: note.targetMs,
    };
  });
}

function toFeedback(judgment: Judgment): HighwayFeedback {
  const { detail, label } = describeJudgment(judgment);
  return {
    detail,
    key: `${judgment.index}-${judgment.rating}`,
    label,
    tone: judgment.rating,
  };
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-semibold text-2xl tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

/** The test game: play the warm-up chart along with the sliding circles. */
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

  const sessionRef = useRef<AudioSession | null>(null);
  const judgeRef = useRef<Judge | null>(null);
  const endsAtRef = useRef(0);

  // Settings live in the browser, so read them after hydration.
  useEffect(() => {
    setBpm(loadTempo());
    setLatencyOffsetMs(loadLatencyOffset());
    setDemo(isDemoMode());
  }, []);

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
    setFeedback(toFeedback(latest));
  }, []);

  const start = async () => {
    setPhase("starting");
    setError("");
    setJudgments([]);
    setFeedback(null);
    judgeRef.current = null;
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
          }),
      });
      sessionRef.current = session;

      const scheduled = scheduleChart(WARM_UP, {
        bpm,
        startMs: session.clock.now() + LEAD_IN_MS,
      });
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
      const closed = judge.closeWindows(nowMs);
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

  const summary = summarize(judgments);
  const playing = phase === "playing" || phase === "starting";
  let buttonLabel = phase === "finished" ? "Play again" : "Start";
  if (playing) {
    buttonLabel = "Stop";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex min-w-48 flex-1 flex-col gap-2 text-sm">
          <span className="flex justify-between">
            <span className="font-medium">Tempo</span>
            <span className="text-muted-foreground tabular-nums">
              {bpm} BPM
            </span>
          </span>
          <input
            className="accent-foreground"
            disabled={playing}
            max={TEMPO.max}
            min={TEMPO.min}
            onChange={changeTempo}
            step={TEMPO.step}
            type="range"
            value={bpm}
          />
        </label>
        <p className="text-muted-foreground text-sm">
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
        </p>
      </div>

      <Highway
        feedback={feedback}
        getNow={getNow}
        notes={toHighwayNotes(notes, judgments)}
        onFrame={onFrame}
      />

      <div className="grid grid-cols-4 gap-2 rounded-2xl border p-4">
        <Stat label="Score" value={summary.score.toLocaleString("en-US")} />
        <Stat label="Perfect" value={summary.counts.perfect} />
        <Stat label="Good" value={summary.counts.good} />
        <Stat label="Miss" value={summary.counts.miss} />
      </div>

      {phase === "finished" && (
        <section className="flex flex-col gap-2 rounded-2xl border p-6">
          <h2 className="font-semibold text-xl">Run complete</h2>
          <p>
            {summary.counts.perfect} Perfect, {summary.counts.good} Good,{" "}
            {summary.counts.miss} Miss, out of {notes.length} notes. Score{" "}
            {summary.score.toLocaleString("en-US")}.
          </p>
          <p className="text-muted-foreground">
            {summary.averageOffsetMs === null
              ? "No notes were hit, so there's no average timing."
              : `Average timing of your hits: ${describeOffset(summary.averageOffsetMs)}.`}
            {!demo &&
              summary.averageOffsetMs !== null &&
              Math.abs(summary.averageOffsetMs) > 30 &&
              " If most hits lean the same way, try calibrating."}
          </p>
        </section>
      )}

      <Button
        className="w-full"
        disabled={phase === "starting"}
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
        {phase === "error"
          ? error
          : "Play each note as its circle reaches the outline."}
      </p>
    </div>
  );
}
