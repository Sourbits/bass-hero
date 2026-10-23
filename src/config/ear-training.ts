import type { TierId } from "@/config/difficulty";
import type { BassString } from "@/instrument/bass";

/** Ear training settings, all in one place to tune. */
export const EAR_TRAINING = {
  /** First-try answers in a row that raise the multiplier by one. */
  comboStep: 3,
  /**
   * After playing a note, how long to wait before listening, in ms, so the
   * mic doesn't take the game's own note for your answer. Testing with a
   * laptop, the mic heard the game's note 0.1 to 0.15 s after it played, and
   * a 1.1 s wait dropped real answers played a little early.
   */
  listenAfterMs: 400,
  maxMultiplier: 4,
  /** Tries per note before the answer is shown. */
  maxTries: 3,
  /** Points for getting it on the 1st, 2nd and 3rd try. */
  points: [100, 50, 25],
  /** Notes per round. */
  prompts: 10,
};

/** One ear training level: which notes it asks for. */
export interface EarLevel {
  description: string;
  /** Highest fret its notes are on. */
  maxFret: number;
  name: string;
  /** Leave out sharps. */
  naturalsOnly: boolean;
  strings: BassString[];
  /** The game tier it's like, for achievements ("Golden Ears"). */
  tier: TierId;
}

const ALL_STRINGS: BassString[] = ["E", "A", "D", "G"];

/**
 * Ear training's own levels, separate from the game's: each asks for more
 * notes, closer together. Duplicate pitches (the 5th fret and the next open
 * string) count once.
 */
export const EAR_LEVELS: EarLevel[] = [
  {
    description: "The four open strings, far apart and easy to tell.",
    maxFret: 0,
    name: "Open strings",
    naturalsOnly: true,
    strings: ALL_STRINGS,
    tier: "easy",
  },
  {
    description: "E, F, G on the E string and A, B, C on the A string.",
    maxFret: 3,
    name: "Low naturals",
    naturalsOnly: true,
    strings: ["E", "A"],
    tier: "easy",
  },
  {
    description: "Natural notes up to the 3rd fret on every string.",
    maxFret: 3,
    name: "First frets",
    naturalsOnly: true,
    strings: ALL_STRINGS,
    tier: "easy",
  },
  {
    description: "Every note on the E string to the 5th fret, sharps too.",
    maxFret: 5,
    name: "Half steps",
    naturalsOnly: false,
    strings: ["E"],
    tier: "medium",
  },
  {
    description: "Every note up to the 4th fret on every string.",
    maxFret: 4,
    name: "First position",
    naturalsOnly: false,
    strings: ALL_STRINGS,
    tier: "medium",
  },
  {
    description: "Every note up to the 5th fret.",
    maxFret: 5,
    name: "To the 5th fret",
    naturalsOnly: false,
    strings: ALL_STRINGS,
    tier: "medium",
  },
  {
    description: "Natural notes up to the 7th fret.",
    maxFret: 7,
    name: "Up the neck",
    naturalsOnly: true,
    strings: ALL_STRINGS,
    tier: "hard",
  },
  {
    description: "Every note up to the 7th fret.",
    maxFret: 7,
    name: "To the 7th fret",
    naturalsOnly: false,
    strings: ALL_STRINGS,
    tier: "hard",
  },
  {
    description: "Natural notes up to the 12th fret.",
    maxFret: 12,
    name: "The octave",
    naturalsOnly: true,
    strings: ALL_STRINGS,
    tier: "demon",
  },
  {
    description: "Any note up to the 12th fret.",
    maxFret: 12,
    name: "The whole neck",
    naturalsOnly: false,
    strings: ALL_STRINGS,
    tier: "demon",
  },
];
