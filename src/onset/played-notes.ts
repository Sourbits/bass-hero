import { createAudioHistory } from "@/audio/audio-history";
import type { AudioSource } from "@/audio/audio-source";
import {
  detectNotes,
  type NoteDetectorOptions,
  type NoteReading,
} from "@/pitch/note-detector";
import type { Note } from "@/pitch/notes";
import { measureBuzz } from "./buzz";
import {
  detectOnsets,
  type Onset,
  type OnsetDetectorOptions,
} from "./onset-detector";

/** The stretch measured for buzz: after the pluck's own click, in ms. */
const BUZZ_FROM_MS = 25;
const BUZZ_TO_MS = 105;

export interface PlayedNote {
  /**
   * How buzzy the note sounded, in dB (see measureBuzz): around −35 or lower
   * is clean, closer to 0 is buzzier. Null when no note was found.
   */
  buzzDb: number | null;
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
  measureBuzzDb = () => null,
  onNote,
}: Pick<PlayedNotesOptions, "attackSkipMs" | "identifyTimeoutMs" | "onNote"> & {
  /** Measures how buzzy a named note is, with audio up to `untilMs`. */
  measureBuzzDb?: (onset: Onset, note: Note, untilMs: number) => number | null;
}) {
  const waiting: Onset[] = [];

  const finish = (onset: Onset, note: Note | null, untilMs: number) => {
    waiting.shift();
    onNote({
      buzzDb: note ? measureBuzzDb(onset, note, untilMs) : null,
      note,
      onsetMs: onset.timeMs,
      peak: onset.peak,
    });
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
          finish(current, null, endMs);
        } else if (startMs >= current.timeMs + attackSkipMs && reading.note) {
          finish(current, reading.note, endMs);
        } else if (endMs - current.timeMs > identifyTimeoutMs) {
          finish(current, null, endMs);
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
  // Keeps recent audio, so each note can be checked for buzz once named.
  const history = createAudioHistory(1);
  const stopHistory = source.onFrame(history.push);
  const pairer = createNotePairer({
    ...options,
    measureBuzzDb: (onset, note, untilMs) => {
      const from = onset.timeMs + BUZZ_FROM_MS;
      const to = Math.min(onset.timeMs + BUZZ_TO_MS, untilMs);
      const samples = history.slice(from / 1000, to / 1000);
      return samples
        ? measureBuzz(samples, history.sampleRate(), note.frequency)
        : null;
    },
  });

  // Onsets subscribe before pitch, so each frame's plucks are known before
  // its pitch reading arrives.
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
    stopHistory();
    stopOnsets();
    stopPitch();
  };
}
