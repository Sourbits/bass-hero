export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

/** Standard concert pitch. */
export const A4_FREQUENCY = 440;
const A4_MIDI = 69;
const SEMITONES_PER_OCTAVE = 12;
const NOTE_PATTERN = /^([A-G])([#b]?)(-?\d+)$/;
const LETTER_SEMITONES: Record<string, number> = {
  A: 9,
  B: 11,
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
};

export interface Note {
  /** How far the pitch is from the note, from -50 (flat) up to +50 (sharp). */
  cents: number;
  /** The frequency that was heard, in Hz. */
  frequency: number;
  /** MIDI note number: 28 is E1, a bass's open low E. */
  midi: number;
  name: NoteName;
  /** Scientific pitch notation: middle C is C4, a bass's low E is E1. */
  octave: number;
}

/** The nearest note to a frequency, and how many cents off it is. */
export function frequencyToNote(
  frequency: number,
  referenceA4 = A4_FREQUENCY
): Note {
  const exact =
    A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(frequency / referenceA4);
  const midi = Math.round(exact);
  const pitchClass =
    ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) %
    SEMITONES_PER_OCTAVE;

  return {
    cents: (exact - midi) * 100,
    frequency,
    midi,
    name: NOTE_NAMES[pitchClass] ?? "C",
    octave: Math.floor(midi / SEMITONES_PER_OCTAVE) - 1,
  };
}

export function midiToFrequency(midi: number, referenceA4 = A4_FREQUENCY) {
  return referenceA4 * 2 ** ((midi - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * Parses a note in scientific pitch notation, such as "E1", "F#2" or "Bb0",
 * into a MIDI note number. Returns null if it isn't a note.
 */
export function parseNote(text: string): number | null {
  const match = NOTE_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }

  const [, letter = "", accidental, octave = ""] = match;
  const semitone = LETTER_SEMITONES[letter] ?? 0;
  let offset = 0;
  if (accidental === "#") {
    offset = 1;
  } else if (accidental === "b") {
    offset = -1;
  }

  return (
    (Number.parseInt(octave, 10) + 1) * SEMITONES_PER_OCTAVE + semitone + offset
  );
}
