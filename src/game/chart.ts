import { parseNote } from "@/pitch/notes";
import type { ExpectedNote } from "@/timing/judge";

export interface ChartNote {
  /** When to play it, in beats from the start of the chart. */
  beat: number;
  /** The note, such as "E1" or "F#2". */
  note: string;
}

export interface Chart {
  notes: ChartNote[];
  title: string;
}

export interface ScheduledNote extends ExpectedNote {
  beat: number;
  /** The note's name, such as "E1". */
  name: string;
}

/**
 * Puts a chart on the game clock: each note's target time is the start time
 * plus its beat at this tempo.
 */
export function scheduleChart(
  chart: Chart,
  { bpm, startMs }: { bpm: number; startMs: number }
): ScheduledNote[] {
  const beatMs = 60_000 / bpm;
  return chart.notes
    .map(({ beat, note }) => {
      const midi = parseNote(note);
      if (midi === null) {
        throw new Error(`Chart "${chart.title}" has an unknown note: ${note}`);
      }
      return { beat, midi, name: note, targetMs: startMs + beat * beatMs };
    })
    .sort((a, b) => a.targetMs - b.targetMs);
}

/** Which string a bass player would usually play this note on, in standard tuning. */
export function stringFor(midi: number): "A" | "D" | "E" | "G" {
  if (midi < 33) {
    return "E";
  }
  if (midi < 38) {
    return "A";
  }
  if (midi < 43) {
    return "D";
  }
  return "G";
}
