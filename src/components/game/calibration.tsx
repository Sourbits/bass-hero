"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeAudioError } from "@/components/audio-errors";
import {
  type AudioSession,
  isDemoMode,
  startAudioSession,
} from "@/components/game/audio-session";
import type { HighwayGem } from "@/components/game/draw-highway";
import {
  type HighwayFeedback,
  NoteHighway,
} from "@/components/game/note-highway";
import { Kbd } from "@/components/kbd";
import { Button } from "@/components/ui/button";
import { releaseFocus, useShortcuts } from "@/components/use-shortcuts";
import { KEYS } from "@/config/shortcuts";
import { CALIBRATION } from "@/config/timing";
import { reportAchievement } from "@/game/achievements";
import type { DemoPluck } from "@/game/demo";
import { detectOnsets } from "@/onset/onset-detector";
import {
  type CalibrationResult,
  suggestLatencyOffset,
} from "@/timing/calibration";
import { describeOffset } from "@/timing/describe";
import { loadLatencyOffset, saveLatencyOffset } from "@/timing/latency-setting";

const LEAD_IN_MS = 2000;
const BEAT_MS = 60_000 / CALIBRATION.bpm;
/** Plucks further than this from a beat don't count for it. */
const MATCH_WINDOW_MS = BEAT_MS * 0.4;
/** The demo plays this late, plus a little wobble, so the suggestion is checkable. */
const DEMO_DELAY_MS = 40;
const DEMO_WOBBLE_MS = [3, -6, 8, -2, 5, -9, 1, 6, -4, 2, -7, 9, 0, -3, 4, -1];

type Phase = "done" | "error" | "idle" | "running" | "starting";

interface Beat {
  /** Count-in beats show the count and don't count toward the result. */
  countIn: boolean;
  label: string;
  targetMs: number;
}

function makeBeats(startMs: number): Beat[] {
  const total = CALIBRATION.countInBeats + CALIBRATION.beats;
  return Array.from({ length: total }, (_, index) => {
    const countIn = index < CALIBRATION.countInBeats;
    return {
      countIn,
      label: String(
        countIn
          ? CALIBRATION.countInBeats - index
          : index - CALIBRATION.countInBeats + 1
      ),
      targetMs: startMs + index * BEAT_MS,
    };
  });
}

function nearestBeat(beats: Beat[], timeMs: number) {
  let nearest = -1;
  for (const [index, beat] of beats.entries()) {
    const distance = Math.abs(timeMs - beat.targetMs);
    if (
      distance <= MATCH_WINDOW_MS &&
      (nearest < 0 ||
        distance < Math.abs(timeMs - (beats[nearest]?.targetMs ?? 0)))
    ) {
      nearest = index;
    }
  }
  return nearest;
}

/** Play along to a steady beat; suggests and saves a latency offset. */
export function Calibration() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [heardBeats, setHeardBeats] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<HighwayFeedback | null>(null);
  const [getNow, setGetNow] = useState<((at?: number) => number) | null>(null);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [savedOffset, setSavedOffset] = useState(0);
  const [manualOffset, setManualOffset] = useState("0");
  const [saveMessage, setSaveMessage] = useState("");

  const sessionRef = useRef<AudioSession | null>(null);
  const beatsRef = useRef<Beat[]>([]);
  const onsetsRef = useRef<number[]>([]);

  useEffect(() => {
    const offset = loadLatencyOffset();
    setSavedOffset(offset);
    setManualOffset(String(offset));
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

  const onOnset = (timeMs: number) => {
    onsetsRef.current.push(timeMs);
    const index = nearestBeat(beatsRef.current, timeMs);
    const beat = beatsRef.current[index];
    if (!beat) {
      return;
    }
    setHeardBeats((previous) => new Set(previous).add(index));
    setFeedback({
      detail: beat.countIn ? "Count-in" : `Beat ${beat.label}`,
      key: String(timeMs),
      label: describeOffset(timeMs - beat.targetMs),
      lane: null,
      tone: "neutral",
    });
  };

  const start = async () => {
    setPhase("starting");
    releaseFocus();
    setError("");
    setResult(null);
    setSaveMessage("");
    setFeedback(null);
    setHeardBeats(new Set());
    onsetsRef.current = [];
    const demoMode = isDemoMode();

    try {
      const session = await startAudioSession({
        demo: demoMode,
        listen: (source) =>
          detectOnsets(source, { onOnset: ({ timeMs }) => onOnset(timeMs) }),
      });
      sessionRef.current = session;

      const scheduled = makeBeats(session.clock.now() + LEAD_IN_MS);
      beatsRef.current = scheduled;
      session.schedulePlucks?.(
        scheduled.map(
          (beat, index): DemoPluck => ({
            midi: 33,
            timeMs:
              beat.targetMs + DEMO_DELAY_MS + (DEMO_WOBBLE_MS[index % 16] ?? 0),
          })
        )
      );

      setBeats(scheduled);
      setGetNow(() => session.clock.now);
      setPhase("running");
    } catch (startError) {
      setError(describeAudioError(startError));
      setPhase("error");
    }
  };

  const onFrame = useCallback(
    (nowMs: number) => {
      const last = beatsRef.current.at(-1);
      if (!last || nowMs < last.targetMs + 1000 || !sessionRef.current) {
        return;
      }
      const counted = beatsRef.current
        .filter((beat) => !beat.countIn)
        .map((beat) => beat.targetMs);
      const suggestion = suggestLatencyOffset(counted, onsetsRef.current, {
        matchWindowMs: MATCH_WINDOW_MS,
        minHits: CALIBRATION.minHits,
      });
      setResult(suggestion);
      if (suggestion) {
        setManualOffset(String(Math.round(suggestion.offsetMs)));
      }
      setPhase("done");
      stopAudio().catch(() => undefined);
    },
    [stopAudio]
  );

  const save = useCallback((offsetMs: number) => {
    if (saveLatencyOffset(offsetMs)) {
      reportAchievement({ kind: "calibrated" });
      const rounded = Math.round(offsetMs);
      setSavedOffset(rounded);
      setManualOffset(String(rounded));
      setSaveMessage(`Saved: ${rounded} ms.`);
    } else {
      setSaveMessage("Couldn't save: this browser is blocking storage.");
    }
  }, []);

  const stop = async () => {
    await stopAudio();
    setPhase("idle");
    setFeedback(null);
  };

  const running = phase === "running" || phase === "starting";
  useShortcuts({
    [KEYS.start]: !running && start,
    [KEYS.stop]: phase === "running" && stop,
  });
  const manualValue = Number(manualOffset);
  let buttonLabel = phase === "done" ? "Try again" : "Start";
  if (running) {
    buttonLabel = "Stop";
  }
  const applySuggestion = useCallback(() => {
    if (result) {
      save(result.offsetMs);
    }
  }, [result, save]);
  const saveManual = useCallback(() => save(manualValue), [manualValue, save]);
  const editManual = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setManualOffset(event.target.value),
    []
  );
  const highwayGems: HighwayGem[] = beats.map((beat, index) => ({
    color: beat.countIn ? "#4a4770" : "#7c3aed",
    key: String(index),
    label: beat.label,
    lane: null,
    small: "",
    state: heardBeats.has(index) ? "hit" : "upcoming",
    targetMs: beat.targetMs,
  }));

  return (
    <div className="flex flex-col gap-6">
      <NoteHighway
        beatTimesMs={beats.map((beat) => beat.targetMs)}
        countdown={false}
        feedback={feedback}
        gems={highwayGems}
        getNow={getNow}
        onFrame={onFrame}
        showLanes={false}
      />

      <Button
        className="w-full"
        disabled={phase === "starting"}
        onClick={running ? stop : start}
        size="lg"
        variant={running ? "outline" : "stage"}
      >
        {buttonLabel}
        <Kbd>{running ? "Esc" : "Space"}</Kbd>
      </Button>

      {phase === "error" && (
        <p className="text-center text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {phase === "done" && (
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-6">
          {result ? (
            <>
              <h2 className="font-semibold text-xl">
                Suggested offset: {Math.round(result.offsetMs)} ms
              </h2>
              <p className="text-muted-foreground">
                Heard {result.hits} of {CALIBRATION.beats} beats. Your plucks
                were within ±{Math.round(result.spreadMs)} ms of that, on a
                typical beat.
                {result.spreadMs > 30 &&
                  " That's a wide spread, so it's worth trying again."}
              </p>
              <Button onClick={applySuggestion}>
                Use {Math.round(result.offsetMs)} ms
              </Button>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-xl">Not enough plucks heard</h2>
              <p className="text-muted-foreground">
                It needs at least {CALIBRATION.minHits} of the{" "}
                {CALIBRATION.beats} beats. Pluck firmly, check that the tuner
                hears your bass, then try again.
              </p>
            </>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-6">
        <h2 className="font-semibold">Latency offset</h2>
        <p className="text-muted-foreground text-sm">
          Saved in this browser: {savedOffset} ms. The game subtracts it from
          every pluck. A positive number means your setup hears plucks late.
        </p>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="latency-offset">
            Latency offset in ms
          </label>
          <input
            className="h-9 w-24 rounded-lg border bg-background px-3 tabular-nums"
            id="latency-offset"
            inputMode="numeric"
            onChange={editManual}
            step={1}
            type="number"
            value={manualOffset}
          />
          <span className="text-muted-foreground text-sm">ms</span>
          <Button
            disabled={!Number.isFinite(manualValue) || manualOffset === ""}
            onClick={saveManual}
            variant="outline"
          >
            Save
          </Button>
        </div>
        {saveMessage ? (
          <p className="text-sm" role="status">
            {saveMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}
