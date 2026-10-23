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

/** Within this many cents of an open string or its overtone, a pitch is that string. */
const MATCH_CENTS = 150;
/** Further than this from every string, a pitch isn't an open string at all. */
const STRAY_CENTS = 600;

/** A pitch read as an open string, for the tuner. */
export interface OpenStringReading extends StringTuning {
  /** True when what was heard is the string's overtone, an octave up. */
  overtone: boolean;
}

function closestString(
  frequency: number,
  strings: readonly BassString[],
  referenceA4: number
) {
  let best = { distance: Number.POSITIVE_INFINITY, string: strings[0] ?? "E" };
  for (const string of strings) {
    const distance = Math.abs(
      centsBetween(
        frequency,
        midiToFrequency(OPEN_STRING_MIDI[string], referenceA4)
      )
    );
    if (distance < best.distance) {
      best = { distance, string };
    }
  }
  return best;
}

/**
 * Reads a pitch as an open string: the picked one, or in "auto" whichever
 * fits.
 *
 * A small mic (a laptop's) barely hears a low E's 41 Hz, so it often hears
 * the string's overtone, an octave up, instead. No open string's overtone
 * lands near another open string, so a pitch that isn't near any string but
 * is near twice one is read as that string. A pitch far from every string,
 * such as the noise of a pluck or a fretted note, gives null.
 */
export function readOpenString(
  frequency: number,
  picked: BassString | "auto" = "auto",
  { inTuneCents = IN_TUNE_CENTS, referenceA4 = A4_FREQUENCY } = {}
): OpenStringReading | null {
  const strings = picked === "auto" ? STRINGS : [picked];
  const options = { inTuneCents, referenceA4 };
  const direct = closestString(frequency, strings, referenceA4);
  if (direct.distance <= MATCH_CENTS) {
    return {
      ...tuneString(frequency, direct.string, options),
      overtone: false,
    };
  }
  const folded = closestString(frequency / 2, strings, referenceA4);
  if (folded.distance <= MATCH_CENTS) {
    return {
      ...tuneString(frequency / 2, folded.string, options),
      overtone: true,
    };
  }
  if (direct.distance <= STRAY_CENTS) {
    return {
      ...tuneString(frequency, direct.string, options),
      overtone: false,
    };
  }
  return null;
}
