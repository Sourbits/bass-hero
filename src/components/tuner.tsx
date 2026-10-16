"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioSource } from "@/audio/audio-source";
import { createMicrophoneSource } from "@/audio/microphone-source";
import { createOscillatorSource } from "@/audio/oscillator-source";
import { describeAudioError } from "@/components/audio-errors";
import { Button } from "@/components/ui/button";
import { detectNotes } from "@/pitch/note-detector";
import { createNoteSmoother } from "@/pitch/note-smoother";
import { midiToFrequency, type Note, parseNote } from "@/pitch/notes";

/** Within this many cents, the needle turns green. */
const IN_TUNE_CENTS = 5;
const LEVEL_FLOOR_DB = -60;
/** The test tone mimics a bass, whose 2nd harmonic is louder than the 1st. */
const TEST_TONE_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];

type Status =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "listening" }
  | { kind: "error"; message: string };

interface TestTone {
  frequency: number;
  label: string;
}

/** Reads a test tone such as ?tone=E1 or ?tone=41.2 from the address bar. */
function readTestTone(): TestTone | null {
  const value = new URLSearchParams(window.location.search).get("tone");
  if (!value) {
    return null;
  }

  const midi = parseNote(value);
  if (midi !== null) {
    return { frequency: midiToFrequency(midi), label: value.trim() };
  }
  const frequency = Number.parseFloat(value);
  if (Number.isFinite(frequency) && frequency > 0) {
    return { frequency, label: `${frequency} Hz` };
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NoteName({ note }: { note: Note | null }) {
  if (!note) {
    return (
      <div className="flex h-36 items-center text-8xl text-muted-foreground/40">
        –
      </div>
    );
  }

  const [letter, accidental] = note.name;
  return (
    <div className="flex h-36 items-center font-semibold">
      <span className="text-9xl leading-none">{letter}</span>
      <span className="flex flex-col justify-between self-stretch py-3 text-4xl">
        <span>{accidental === "#" ? "♯" : ""}</span>
        <span className="text-muted-foreground">{note.octave}</span>
      </span>
    </div>
  );
}

function centsLabel(cents: number) {
  const rounded = Math.round(cents);
  if (rounded === 0) {
    return "In tune";
  }
  const amount = Math.abs(rounded);
  const unit = amount === 1 ? "cent" : "cents";
  return `${amount} ${unit} ${rounded > 0 ? "sharp" : "flat"}`;
}

function CentsMeter({ cents }: { cents: number | null }) {
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS;
  const offset = cents === null ? 0 : clamp(cents, -50, 50);

  return (
    <div className="w-full">
      <div className="relative h-12">
        <div className="absolute inset-y-0 left-[45%] w-[10%] rounded bg-emerald-500/15" />
        {[-50, -25, 0, 25, 50].map((tick) => (
          <div
            className={`absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-border ${tick === 0 ? "h-full" : "h-1/2"}`}
            key={tick}
            style={{ left: `${50 + tick}%` }}
          />
        ))}
        {cents !== null && (
          <div
            className={`absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full transition-[left] duration-75 ${inTune ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ left: `${50 + offset}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-muted-foreground text-xs">
        <span>♭ Flat</span>
        <span>Sharp ♯</span>
      </div>
    </div>
  );
}

function LevelMeter({ levelDb }: { levelDb: number }) {
  const fraction = clamp((levelDb - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB, 0, 1);

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-muted-foreground text-xs">
        <span>Input level</span>
        <span className="tabular-nums">
          {Number.isFinite(levelDb) ? `${Math.round(levelDb)} dB` : "–"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground/50"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}

function statusText(status: Status, testTone: TestTone | null) {
  switch (status.kind) {
    case "idle":
      return testTone
        ? `Test tone mode: ${testTone.label}. Nothing plays out loud.`
        : "Press Start and allow microphone access.";
    case "starting":
      return testTone
        ? "Starting the test tone…"
        : "Waiting for microphone access…";
    case "listening":
      return testTone
        ? `Listening to the test tone: ${testTone.label}.`
        : "Listening. Play one note at a time.";
    default:
      return status.message;
  }
}

/** A chromatic tuner for bass, fed by the mic or by a ?tone= test tone. */
export function Tuner() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [note, setNote] = useState<Note | null>(null);
  const [levelDb, setLevelDb] = useState(Number.NEGATIVE_INFINITY);
  const [testTone, setTestTone] = useState<TestTone | null>(null);
  const stopRef = useRef<(() => Promise<void>) | null>(null);

  // The address bar is only readable in the browser, after hydration.
  useEffect(() => {
    setTestTone(readTestTone());
  }, []);

  useEffect(
    () => () => {
      stopRef.current?.().catch(() => undefined);
    },
    []
  );

  const start = async () => {
    setStatus({ kind: "starting" });
    const tone = readTestTone();
    const source: AudioSource = tone
      ? createOscillatorSource({
          frequency: tone.frequency,
          harmonics: TEST_TONE_HARMONICS,
        })
      : createMicrophoneSource();

    const smoother = createNoteSmoother();
    const stopListening = detectNotes(source, {
      onReading: (reading) => {
        setNote(smoother.update(reading));
        setLevelDb(reading.levelDb);
      },
    });
    const stopAll = async () => {
      stopListening();
      await source.stop();
    };
    stopRef.current = stopAll;

    try {
      await source.start();
      setStatus({ kind: "listening" });
    } catch (error) {
      stopRef.current = null;
      await stopAll();
      setStatus({ kind: "error", message: describeAudioError(error) });
    }
  };

  const stop = async () => {
    const stopAll = stopRef.current;
    stopRef.current = null;
    await stopAll?.();
    setNote(null);
    setLevelDb(Number.NEGATIVE_INFINITY);
    setStatus({ kind: "idle" });
  };

  const listening = status.kind === "listening";

  return (
    <section className="flex flex-col items-center gap-6 rounded-2xl border p-6 sm:p-8">
      <NoteName note={note} />
      <p
        className={`h-6 font-medium tabular-nums ${note && Math.abs(note.cents) <= IN_TUNE_CENTS ? "text-emerald-600" : ""}`}
      >
        {note ? centsLabel(note.cents) : ""}
      </p>
      <CentsMeter cents={note?.cents ?? null} />
      <p className="h-5 text-muted-foreground text-sm tabular-nums">
        {note ? `${note.frequency.toFixed(1)} Hz` : ""}
      </p>
      <LevelMeter levelDb={levelDb} />
      <Button
        className="w-full"
        disabled={status.kind === "starting"}
        onClick={listening ? stop : start}
        size="lg"
        variant={listening ? "outline" : "default"}
      >
        {listening ? "Stop" : "Start"}
      </Button>
      <p
        className={`text-center text-sm ${status.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}
        role={status.kind === "error" ? "alert" : "status"}
      >
        {statusText(status, testTone)}
      </p>
    </section>
  );
}
