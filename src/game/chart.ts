import { parseNote } from "@/pitch/notes";
import type { ExpectedNote } from "@/timing/judge";
import {
  type BassString,
  defaultPosition,
  OPEN_STRING_MIDI,
  type Position,
} from "./positions";

export interface ChartNote {
  /** When to play it, in beats from the start of the chart. */
  beat: number;
  /** The note, such as "E1" or "F#2". */
  note: string;
  /** Which string to play it on. Defaults to the usual one near the nut. */
  string?: BassString;
}

export interface Chart {
  notes: ChartNote[];
  title: string;
}

export interface ScheduledNote extends ExpectedNote, Position {
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
    .map(({ beat, note, string }) => {
      const midi = parseNote(note);
      if (midi === null) {
        throw new Error(`Chart "${chart.title}" has an unknown note: ${note}`);
      }
      const position = string
        ? { fret: midi - OPEN_STRING_MIDI[string], string }
        : defaultPosition(midi);
      if (position.fret < 0) {
        throw new Error(
          `Chart "${chart.title}" puts ${note} on the ${string} string, which is too low`
        );
      }
      return {
        beat,
        midi,
        name: note,
        targetMs: startMs + beat * beatMs,
        ...position,
      };
    })
    .sort((a, b) => a.targetMs - b.targetMs);
}

/** Every distinct place a chart's notes are played. */
export function chartPositions(chart: Chart): Position[] {
  const seen = new Map<string, Position>();
  for (const note of scheduleChart(chart, { bpm: 60, startMs: 0 })) {
    seen.set(`${note.string}${note.fret}`, {
      fret: note.fret,
      string: note.string,
    });
  }
  return [...seen.values()];
}
