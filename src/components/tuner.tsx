"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioHistory } from "@/audio/audio-history";
import type { AudioSource } from "@/audio/audio-source";
import { createMicrophoneSource } from "@/audio/microphone-source";
import { createOscillatorSource } from "@/audio/oscillator-source";
import { describeAudioError } from "@/components/audio-errors";
import { Kbd } from "@/components/kbd";
import { useSettings } from "@/components/settings-provider";
import { STRING_COLORS } from "@/components/string-colors";
import { Button } from "@/components/ui/button";
import { useShortcuts } from "@/components/use-shortcuts";
import { KEYS } from "@/config/shortcuts";
import { TIMING } from "@/config/timing";
import { debugLog, isDebugLogOn, r } from "@/debug/debug-log";
import { reportAchievement } from "@/game/achievements";
import { type BassString, OPEN_STRING_MIDI, STRINGS } from "@/instrument/bass";
import { measureBuzz } from "@/onset/buzz";
import { detectNotes, type NoteReading } from "@/pitch/note-detector";
import { createNoteSmoother } from "@/pitch/note-smoother";
import {
  midiToFrequency,
  midiToName,
  type Note,
  parseNote,
} from "@/pitch/notes";
import {
  IN_TUNE_CENTS,
  type OpenStringReading,
  readOpenString,
  type StringTuning,
} from "@/pitch/string-tuning";

const LEVEL_FLOOR_DB = -60;
/** The test tone mimics a bass, whose 2nd harmonic is louder than the 1st. */
const TEST_TONE_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];
/** How quickly the buzz meter follows new readings, from 0 to 1. */
const BUZZ_RESPONSE = 0.3;

type Status =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "listening" }
  | { kind: "error"; message: string };

/** "auto" picks the nearest open string; otherwise the one the player chose. */
type StringChoice = BassString | "auto";

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

function centsText(cents: number) {
  const amount = Math.abs(Math.round(cents));
  if (amount === 0) {
    return "Right on";
  }
  const unit = amount === 1 ? "cent" : "cents";
  return `${amount} ${unit} ${cents > 0 ? "sharp" : "flat"}`;
}

const DIRECTION_TEXT = {
  down: { arrow: "↓", hint: "Loosen the string", label: "Tune down" },
  "in-tune": {
    arrow: "✓",
    hint: "Move on to the next string",
    label: "In tune",
  },
  up: { arrow: "↑", hint: "Tighten the string", label: "Tune up" },
} as const;

/** E, A, D, G from left to right, or mirrored in left-handed mode. */
function useStringOrder(): readonly BassString[] {
  const { leftHanded } = useSettings().settings;
  return leftHanded ? [...STRINGS].reverse() : STRINGS;
}

function StringPicker({
  choice,
  onChoose,
}: {
  choice: StringChoice;
  onChoose: (choice: StringChoice) => void;
}) {
  const choices: StringChoice[] = ["auto", ...useStringOrder()];
  return (
    <fieldset className="flex w-full flex-col items-center gap-2">
      <legend className="mb-2 text-center text-muted-foreground text-sm">
        String: let it detect which one, or pick it
      </legend>
      <div className="flex w-full max-w-sm gap-1 rounded-2xl border bg-background/40 p-1">
        {choices.map((option) => (
          <ChoiceButton
            choice={option}
            key={option}
            onChoose={onChoose}
            selected={choice === option}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ChoiceButton({
  choice,
  onChoose,
  selected,
}: {
  choice: StringChoice;
  onChoose: (choice: StringChoice) => void;
  selected: boolean;
}) {
  const choose = useCallback(() => onChoose(choice), [choice, onChoose]);
  return (
    <button
      aria-pressed={selected}
      className={`flex-1 rounded-lg py-1.5 font-semibold text-sm transition-colors ${
        selected ? "bg-foreground text-background" : "hover:bg-muted"
      }`}
      onClick={choose}
      type="button"
    >
      {choice === "auto" ? "Auto" : String(choice)}
    </button>
  );
}

function TuningDisplay({
  heard,
  tuning,
}: {
  heard: Note | null;
  tuning: OpenStringReading | null;
}) {
  if (!(tuning && heard)) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
        <span className="text-6xl text-muted-foreground/40">–</span>
        <span className="text-muted-foreground">Play an open string</span>
      </div>
    );
  }

  const text = DIRECTION_TEXT[tuning.direction];
  const inTune = tuning.direction === "in-tune";
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-1 text-center">
      <span
        className="font-semibold text-lg"
        style={{ color: STRING_COLORS[tuning.string] }}
      >
        {tuning.string} string · target {tuning.targetName.replace("#", "♯")}
      </span>
      <span
        className={`font-bold text-5xl ${inTune ? "text-good" : "text-gold"}`}
      >
        {text.arrow} {text.label}
      </span>
      <span className="font-medium tabular-nums">
        {centsText(tuning.cents)}
        {inTune ? "" : ` · ${text.hint}`}
      </span>
      <span className="text-muted-foreground text-sm tabular-nums">
        Hearing {heard.name.replace("#", "♯")}
        {heard.octave} · {heard.frequency.toFixed(1)} Hz
        {tuning.overtone ? " (its overtone, an octave up)" : ""}
      </span>
    </div>
  );
}

function CentsMeter({ cents }: { cents: number | null }) {
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS;
  const offset = cents === null ? 0 : clamp(cents, -50, 50);
  const pegged = cents !== null && Math.abs(cents) > 50;

  return (
    <div className="w-full">
      <div className="relative h-12">
        <div className="absolute inset-y-0 left-[45%] w-[10%] rounded bg-good/15" />
        {[-50, -25, 0, 25, 50].map((tick) => (
          <div
            className={`absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-border ${tick === 0 ? "h-full" : "h-1/2"}`}
            key={tick}
            style={{ left: `${50 + tick}%` }}
          />
        ))}
        {cents === null ? null : (
          <div
            className={`absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full transition-[left] duration-75 ${inTune ? "bg-good" : "bg-gold"} ${pegged ? "animate-pulse" : ""}`}
            style={{ left: `${50 + offset}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-muted-foreground text-xs">
        <span>♭ Flat: tune up</span>
        <span>Sharp: tune down ♯</span>
      </div>
    </div>
  );
}

function StringStatusRow({
  statuses,
}: {
  statuses: Partial<Record<BassString, StringTuning>>;
}) {
  const order = useStringOrder();
  return (
    <div className="grid w-full grid-cols-4 gap-2">
      {order.map((string) => {
        const status = statuses[string];
        let mark = "–";
        if (status) {
          mark = DIRECTION_TEXT[status.direction].arrow;
        }
        return (
          <div
            className="flex flex-col items-center rounded-xl border bg-background/40 py-2"
            key={string}
          >
            <span
              className="font-semibold"
              style={{ color: STRING_COLORS[string] }}
            >
              {string}
            </span>
            <span
              className={`text-xl ${status?.direction === "in-tune" ? "text-good" : ""}`}
            >
              {mark}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {status
                ? `${Math.round(status.cents)}¢`
                : midiToName(OPEN_STRING_MIDI[string])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Meter({
  fraction,
  label,
  marker,
  tone = "neutral",
  value,
}: {
  fraction: number;
  label: string;
  marker?: number;
  tone?: "bad" | "neutral";
  value: string;
}) {
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-muted-foreground text-xs">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${tone === "bad" ? "bg-bad" : "bg-foreground/50"}`}
          style={{ width: `${clamp(fraction, 0, 1) * 100}%` }}
        />
        {marker === undefined ? null : (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground"
            style={{ left: `${marker * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** Buzz meter range, in dB: clean notes sit near the bottom. */
const BUZZ_FLOOR_DB = -50;
const BUZZ_CEILING_DB = -10;
const buzzFraction = (db: number) =>
  (db - BUZZ_FLOOR_DB) / (BUZZ_CEILING_DB - BUZZ_FLOOR_DB);

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
        : "Listening. Play one open string at a time.";
    default:
      return status.message;
  }
}

/** How often the tuner writes to the debug log while it hears a note, in ms. */
const TUNER_LOG_EVERY_MS = 250;
let lastTunerLog = 0;

/** A few tuner readings a second, for the debug log. */
function logTunerReading(
  reading: NoteReading,
  shown: Note | null,
  picked: StringChoice,
  buzzDb: number | null
) {
  const now = performance.now();
  if (!(shown && isDebugLogOn()) || now - lastTunerLog < TUNER_LOG_EVERY_MS) {
    return;
  }
  lastTunerLog = now;
  const heard = readOpenString(shown.frequency, picked);
  debugLog("tuner", {
    buzzDb: r(buzzDb),
    cents: r(heard?.cents, 0),
    clarity: r(reading.clarity, 3),
    direction: heard?.direction ?? "not an open string",
    hz: r(shown.frequency, 2),
    levelDb: r(reading.levelDb),
    note: `${shown.name}${shown.octave}`,
    overtone: heard?.overtone ?? false,
    picked,
    string: heard?.string ?? null,
  });
}

/** A bass tuner: tells you which way to turn each string's peg. */
export function Tuner() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [note, setNote] = useState<Note | null>(null);
  const [levelDb, setLevelDb] = useState(Number.NEGATIVE_INFINITY);
  const [buzzDb, setBuzzDb] = useState<number | null>(null);
  const [choice, setChoice] = useState<StringChoice>("auto");
  const [statuses, setStatuses] = useState<
    Partial<Record<BassString, StringTuning>>
  >({});
  const [testTone, setTestTone] = useState<TestTone | null>(null);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  // Read by the audio callback, which outlives any one render.
  const choiceRef = useRef<StringChoice>("auto");
  const statusesRef = useRef<Partial<Record<BassString, StringTuning>>>({});
  const tunedRef = useRef<boolean>(false);

  const choose = useCallback((next: StringChoice) => {
    choiceRef.current = next;
    setChoice(next);
  }, []);

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

  const tuning = note ? readOpenString(note.frequency, choice) : null;

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
    const history = createAudioHistory(0.5);
    const stopHistory = source.onFrame(history.push);
    const stopListening = detectNotes(source, {
      onReading: (reading) => {
        const shown = smoother.update(reading);
        setNote(shown);
        // Remember the latest reading for each string, for the status row.
        const heard = shown
          ? readOpenString(shown.frequency, choiceRef.current)
          : null;
        if (heard) {
          statusesRef.current = {
            ...statusesRef.current,
            [heard.string]: heard,
          };
          setStatuses(statusesRef.current);
          // All four strings in tune, by their latest readings. A test tone
          // is only ever one note, so it can't do this.
          if (
            !(tone || tunedRef.current) &&
            STRINGS.every(
              (string) => statusesRef.current[string]?.direction === "in-tune"
            )
          ) {
            tunedRef.current = true;
            reportAchievement({ kind: "tuned" });
          }
        }
        setLevelDb(reading.levelDb);
        const samples = history.slice(reading.windowStart, reading.time);
        let measured: number | null = null;
        if (reading.note && samples) {
          measured = measureBuzz(
            samples,
            history.sampleRate(),
            reading.note.frequency
          );
          const latest = measured;
          setBuzzDb((previous) =>
            previous === null
              ? latest
              : previous + BUZZ_RESPONSE * (latest - previous)
          );
        } else if (!shown) {
          setBuzzDb(null);
        }
        logTunerReading(reading, shown, choiceRef.current, measured);
      },
    });
    const stopAll = async () => {
      stopHistory();
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
    setBuzzDb(null);
    setLevelDb(Number.NEGATIVE_INFINITY);
    setStatus({ kind: "idle" });
  };

  const listening = status.kind === "listening";
  const pick = (next: StringChoice) => () => choose(next);
  useShortcuts({
    [KEYS.start]: status.kind !== "starting" && (listening ? stop : start),
    [KEYS.tunerAuto]: pick("auto"),
    a: pick("A"),
    d: pick("D"),
    e: pick("E"),
    g: pick("G"),
  });
  const buzzing = buzzDb !== null && buzzDb > TIMING.buzzThresholdDb;
  let buzzValue = "–";
  if (buzzDb !== null) {
    buzzValue = `${buzzing ? "Buzzing" : "Clean"} · ${Math.round(buzzDb)} dB`;
  }

  return (
    <section className="flex flex-col items-center gap-6 rounded-3xl border bg-card p-6 sm:p-8">
      <StringPicker choice={choice} onChoose={choose} />
      <TuningDisplay heard={note} tuning={tuning} />
      <CentsMeter cents={tuning?.cents ?? null} />
      <StringStatusRow statuses={statuses} />
      <div className="flex w-full flex-col gap-3">
        <Meter
          fraction={(levelDb - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB}
          label="Input level"
          value={Number.isFinite(levelDb) ? `${Math.round(levelDb)} dB` : "–"}
        />
        <Meter
          fraction={buzzDb === null ? 0 : buzzFraction(buzzDb)}
          label="Fret buzz (the line is where the game counts a miss)"
          marker={buzzFraction(TIMING.buzzThresholdDb)}
          tone={buzzing ? "bad" : "neutral"}
          value={buzzValue}
        />
      </div>
      <Button
        className="w-full"
        disabled={status.kind === "starting"}
        onClick={listening ? stop : start}
        size="lg"
        variant={listening ? "outline" : "stage"}
      >
        {listening ? "Stop" : "Start"}
        <Kbd>Space</Kbd>
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
