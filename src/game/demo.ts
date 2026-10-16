import type { ScheduledNote } from "./chart";

export interface DemoPluck {
  midi: number;
  /** When to pluck, on the game clock, in ms. */
  timeMs: number;
}

/**
 * How the demo player plays each note, in order: an offset in ms, or a
 * mistake. It covers every rating so the whole loop can be checked without a
 * bass: on time, a little off, Good early and late, a wrong note, a skipped
 * note and a late Miss.
 */
const SCRIPT: (number | "skip" | "wrong")[] = [
  0,
  25,
  -30,
  80,
  -90,
  "wrong",
  "skip",
  160,
  0,
  10,
  -15,
  60,
  0,
  -40,
  5,
  0,
];

/** Plucks for a scripted, imperfect performance of the chart. */
export function demoPerformance(notes: ScheduledNote[]): DemoPluck[] {
  return notes.flatMap((note, index) => {
    const step = SCRIPT[index % SCRIPT.length] ?? 0;
    if (step === "skip") {
      return [];
    }
    if (step === "wrong") {
      return [{ midi: note.midi + 2, timeMs: note.targetMs }];
    }
    return [{ midi: note.midi, timeMs: note.targetMs + step }];
  });
}
