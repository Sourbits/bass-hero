import type { AudioSource } from "@/audio/audio-source";
import {
  detectNotes,
  type NoteDetectorOptions,
  type NoteReading,
} from "@/pitch/note-detector";
import type { Note } from "@/pitch/notes";
import {
  detectOnsets,
  type Onset,
  type OnsetDetectorOptions,
} from "./onset-detector";

export interface PlayedNote {
  /** The note heard after the pluck, or null if no clear pitch was found. */
  note: Note | null;
  /** When the string was plucked, on the source's clock, in ms. */
  onsetMs: number;
  /** Peak level of the note just after the pluck, from 0 to 1. */
  peak: number;
}

export interface PlayedNotesOptions {
  /**
   * Pitch readings are only trusted once their window starts this long after
   * the pluck, so the attack and the previous note are left out. In ms.
   * Defaults to 10.
   */
  attackSkipMs?: number;
  /** Give up naming a pluck after this long, in ms. Defaults to 400. */
  identifyTimeoutMs?: number;
  /** Called for every pluck once its note is known, or known to be unclear. */
  onNote: (played: PlayedNote) => void;
  /** Called as soon as a pluck is found, before its note is known. */
  onOnset?: (onset: Onset) => void;
  /** Every pitch reading, for example to drive a level meter. */
  onReading?: (reading: NoteReading) => void;
  onsets?: Omit<OnsetDetectorOptions, "onOnset">;
  pitch?: Omit<NoteDetectorOptions, "onReading">;
}

/**
 * Pairs every pluck with the note that was played, using the onset detector
 * for the time and the pitch detector for the note.
 *
 * The time is always the pluck's: low notes take ~100 ms to name, so using
 * the moment the pitch was recognized would make every hit late.
 */
export function createNotePairer({
  attackSkipMs = 10,
  identifyTimeoutMs = 400,
  onNote,
}: Pick<PlayedNotesOptions, "attackSkipMs" | "identifyTimeoutMs" | "onNote">) {
  const waiting: Onset[] = [];

  const finish = (onset: Onset, note: Note | null) => {
    waiting.shift();
    onNote({ note, onsetMs: onset.timeMs, peak: onset.peak });
  };

  return {
    addOnset: (onset: Onset) => {
      waiting.push(onset);
    },
    addReading: (reading: NoteReading) => {
      const startMs = reading.windowStart * 1000;
      const endMs = reading.time * 1000;

      let [current, next] = waiting;
      while (current) {
        if (next && endMs > next.timeMs) {
          // The window already holds the next pluck, so this one can't be
          // named any more.
          finish(current, null);
        } else if (startMs >= current.timeMs + attackSkipMs && reading.note) {
          finish(current, reading.note);
        } else if (endMs - current.timeMs > identifyTimeoutMs) {
          finish(current, null);
        } else {
          return;
        }
        [current, next] = waiting;
      }
    },
  };
}

/** Reports every note played into an audio source. Returns a function that stops listening. */
export function detectPlayedNotes(
  source: AudioSource,
  options: PlayedNotesOptions
): () => void {
  const pairer = createNotePairer(options);

  // Onsets subscribe first, so each frame's plucks are known before its
  // pitch reading arrives.
  const stopOnsets = detectOnsets(source, {
    ...options.onsets,
    onOnset: (onset) => {
      options.onOnset?.(onset);
      pairer.addOnset(onset);
    },
  });
  const stopPitch = detectNotes(source, {
    ...options.pitch,
    onReading: (reading) => {
      options.onReading?.(reading);
      pairer.addReading(reading);
    },
  });

  return () => {
    stopOnsets();
    stopPitch();
  };
}
