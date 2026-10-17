import { type BassString, OPEN_STRING_MIDI } from "@/instrument/bass";
import { midiToName } from "@/pitch/notes";

/** Where a note is played: which string, and which fret (0 is open). */
export interface Position {
  fret: number;
  string: BassString;
}

export function positionMidi({ fret, string }: Position) {
  return OPEN_STRING_MIDI[string] + fret;
}

/** A short id for a position, such as "E3" for the 3rd fret of the E string. */
export function positionKey({ fret, string }: Position) {
  return `${string}${fret}`;
}

/** The note's name at a position, such as "G1". */
export function positionName(position: Position) {
  return midiToName(positionMidi(position));
}

/**
 * Where a bass player would usually play a note near the nut: up to the 4th
 * fret, on the thickest string that has it. Higher notes go on the G string.
 */
export function defaultPosition(midi: number): Position {
  let string: BassString = "G";
  if (midi < OPEN_STRING_MIDI.A) {
    string = "E";
  } else if (midi < OPEN_STRING_MIDI.D) {
    string = "A";
  } else if (midi < OPEN_STRING_MIDI.G) {
    string = "D";
  }
  return { fret: Math.max(0, midi - OPEN_STRING_MIDI[string]), string };
}
