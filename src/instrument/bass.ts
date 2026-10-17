/** A 4-string bass in standard tuning, thickest string first. */
export const STRINGS = ["E", "A", "D", "G"] as const;
export type BassString = (typeof STRINGS)[number];

/** MIDI note of each open string: E1, A1, D2, G2. */
export const OPEN_STRING_MIDI: Record<BassString, number> = {
  A: 33,
  D: 38,
  E: 28,
  G: 43,
};
