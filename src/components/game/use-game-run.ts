"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeAudioError } from "@/components/audio-errors";
import {
  type AudioSession,
  isDemoMode,
  startAudioSession,
} from "@/components/game/audio-session";
import { toFeedback } from "@/components/game/game-parts";
import type { HighwayFeedback } from "@/components/game/note-highway";
import { TIMING, type TimingConfig } from "@/config/timing";
import { type Chart, type ScheduledNote, scheduleChart } from "@/game/chart";
import { demoPerformance } from "@/game/demo";
import { detectPlayedNotes } from "@/onset/played-notes";
import { createJudge, type Judge, type Judgment } from "@/timing/judge";
import { loadLatencyOffset } from "@/timing/latency-setting";

/** Time from pressing Start to the first note's target, in ms. */
const LEAD_IN_MS = 3000;
/** How long to keep the screen running after the last note, in ms. */
const OUTRO_MS = 1500;

export type RunPhase = "error" | "finished" | "idle" | "playing" | "starting";

export interface RunOptions {
  bpm: number;
  chart: Chart;
  config?: TimingConfig;
  /** Play each note out loud as it reaches the strike line. */
  guideTone?: boolean;
  /** Called once when every note is judged and the run ends. */
  onFinish?: (run: FinishedRun) => void;
}

export interface FinishedRun {
  judgments: (Judgment | undefined)[];
  notes: ScheduledNote[];
}

/**
 * One run of the game: opens the mic (or the demo bass), schedules a chart on
 * the game clock, judges every played note, and finishes once every note is
 * judged. Shared by the Game and Practice pages.
 */
export function useGameRun() {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [error, setError] = useState("");
  const [bpm, setBpm] = useState(60);
  const [notes, setNotes] = useState<ScheduledNote[]>([]);
  const [judgments, setJudgments] = useState<(Judgment | undefined)[]>([]);
  const [feedback, setFeedback] = useState<HighwayFeedback | null>(null);
  const [getNow, setGetNow] = useState<(() => number) | null>(null);

  const sessionRef = useRef<AudioSession | null>(null);
  const judgeRef = useRef<Judge | null>(null);
  const notesRef = useRef<ScheduledNote[]>([]);
  const endsAtRef = useRef(0);
  const onFinishRef = useRef<RunOptions["onFinish"]>(undefined);
  /** How far the audio has been analyzed, on the game clock, in ms. */
  const analyzedMsRef = useRef(0);

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

  const start = useCallback(
    async ({
      bpm: tempo,
      chart,
      config = TIMING,
      guideTone,
      onFinish,
    }: RunOptions) => {
      setPhase("starting");
      onFinishRef.current = onFinish;
      setError("");
      setJudgments([]);
      setFeedback(null);
      judgeRef.current = null;
      analyzedMsRef.current = 0;
      const demo = isDemoMode();

      try {
        const session = await startAudioSession({
          demo,
          listen: (source) =>
            detectPlayedNotes(source, {
              onNote: ({ buzzDb, note, onsetMs }) => {
                const judge = judgeRef.current;
                const judgment = judge?.judgeHit({
                  buzzDb,
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

        const scheduled = scheduleChart(chart, {
          bpm: tempo,
          startMs: session.clock.now() + LEAD_IN_MS,
        });
        notesRef.current = scheduled;
        // The demo plays with no latency, so it needs no calibration offset.
        judgeRef.current = createJudge(scheduled, {
          config,
          latencyOffsetMs: demo ? 0 : loadLatencyOffset(),
        });
        endsAtRef.current = (scheduled.at(-1)?.targetMs ?? 0) + OUTRO_MS;
        session.schedulePlucks?.(demoPerformance(scheduled));
        if (guideTone) {
          session.playAloud(
            scheduled.map(({ midi, targetMs }) => ({ midi, timeMs: targetMs }))
          );
        }

        setBpm(tempo);
        setNotes(scheduled);
        setGetNow(() => session.clock.now);
        setPhase("playing");
      } catch (startError) {
        await stopAudio();
        setError(describeAudioError(startError));
        setPhase("error");
      }
    },
    [show, stopAudio]
  );

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
        onFinishRef.current?.({
          judgments: judge.judgments(),
          notes: notesRef.current,
        });
        stopAudio().catch(() => undefined);
      }
    },
    [show, stopAudio]
  );

  const stop = useCallback(async () => {
    judgeRef.current = null;
    await stopAudio();
    setPhase("idle");
    setFeedback(null);
  }, [stopAudio]);

  return {
    bpm,
    error,
    feedback,
    getNow,
    judgments,
    notes,
    onFrame,
    phase,
    playing: phase === "playing" || phase === "starting",
    start,
    stop,
  };
}
