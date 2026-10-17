import { type BassString, OPEN_STRING_MIDI, STRINGS } from "@/instrument/bass";
import { A4_FREQUENCY, midiToFrequency, midiToName } from "./notes";

/** Which way to turn the tuning peg: up tightens the string, down loosens it. */
export type TuneDirection = "down" | "in-tune" | "up";

export interface StringTuning {
  /** How far the string is from its note, in cents. Negative is flat. */
  cents: number;
  direction: TuneDirection;
  string: BassString;
  /** The note the open string should be, such as "E1". */
  targetName: string;
}

/** Within this many cents of the target, a string counts as in tune. */
export const IN_TUNE_CENTS = 5;

export function centsBetween(frequency: number, target: number) {
  return 1200 * Math.log2(frequency / target);
}

/**
 * The open string whose note is nearest to this pitch. A string tuned more
 * than about two and a half semitones off can be mistaken for its neighbor;
 * picking the string by hand avoids that.
 */
export function nearestString(
  frequency: number,
  referenceA4 = A4_FREQUENCY
): BassString {
  let nearest: BassString = "E";
  let best = Number.POSITIVE_INFINITY;
  for (const string of STRINGS) {
    const distance = Math.abs(
      centsBetween(
        frequency,
        midiToFrequency(OPEN_STRING_MIDI[string], referenceA4)
      )
    );
    if (distance < best) {
      best = distance;
      nearest = string;
    }
  }
  return nearest;
}

/** How far an open string is from its note, and which way to tune it. */
export function tuneString(
  frequency: number,
  string: BassString,
  { inTuneCents = IN_TUNE_CENTS, referenceA4 = A4_FREQUENCY } = {}
): StringTuning {
  const midi = OPEN_STRING_MIDI[string];
  const cents = centsBetween(frequency, midiToFrequency(midi, referenceA4));
  let direction: TuneDirection = "in-tune";
  if (cents < -inTuneCents) {
    direction = "up";
  } else if (cents > inTuneCents) {
    direction = "down";
  }
  return { cents, direction, string, targetName: midiToName(midi) };
}
