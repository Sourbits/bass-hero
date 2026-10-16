import type { NoteReading } from "./note-detector";
import type { Note } from "./notes";

export interface NoteSmootherOptions {
  /**
   * How many readings in a row a different note needs before the display
   * switches to it. This hides the stray readings a pluck's attack can cause.
   * Defaults to 2.
   */
  confirmReadings?: number;
  /** Seconds to keep showing a note after it stops being heard. Defaults to 0.4. */
  holdSeconds?: number;
  /**
   * How quickly the cents value follows new readings, from 0 (frozen) to 1
   * (no smoothing). Defaults to 0.3.
   */
  response?: number;
}

/**
 * Turns raw readings into something steady enough to read on a tuner: the
 * cents value is smoothed, a note is held briefly as it fades, and a single
 * odd reading doesn't change the note shown.
 */
export function createNoteSmoother({
  confirmReadings = 2,
  holdSeconds = 0.4,
  response = 0.3,
}: NoteSmootherOptions = {}) {
  let shown: Note | null = null;
  let lastHeard = Number.NEGATIVE_INFINITY;
  let candidate: { count: number; midi: number } | null = null;

  const follow = (current: Note, next: Note): Note => ({
    ...current,
    cents: current.cents + response * (next.cents - current.cents),
    frequency:
      current.frequency + response * (next.frequency - current.frequency),
  });

  const switchesTo = (note: Note) => {
    if (candidate?.midi === note.midi) {
      candidate.count += 1;
    } else {
      candidate = { count: 1, midi: note.midi };
    }
    return candidate.count >= confirmReadings;
  };

  return {
    update: ({ note, time }: NoteReading): Note | null => {
      if (!note) {
        candidate = null;
        if (time - lastHeard > holdSeconds) {
          shown = null;
        }
        return shown;
      }

      lastHeard = time;
      if (!shown) {
        candidate = null;
        shown = note;
      } else if (note.midi === shown.midi) {
        candidate = null;
        shown = follow(shown, note);
      } else if (switchesTo(note)) {
        candidate = null;
        shown = note;
      }
      return shown;
    },
  };
}
