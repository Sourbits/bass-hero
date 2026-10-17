/**
 * The game's difficulty settings, all in one place to tune. Each tier adds
 * strings and frets; each of its levels 1–10 moves around the neck more and
 * speeds up a little.
 */

export type TierId = "easy" | "hard" | "medium";

export interface TierConfig {
  /** Tempo at level 1 and at level 10; levels in between are spread evenly. */
  bpm: [number, number];
  description: string;
  /** Highest fret used. */
  maxFret: number;
  name: string;
  /** Only natural notes (no sharps), or every note. */
  naturalsOnly: boolean;
  /** Notes per run. */
  notes: number;
  /** Show the fretboard map under the highway. Off: play from memory. */
  showFretboard: boolean;
  /** Write the fret number under each note on the highway. */
  showFretHints: boolean;
  strings: ("A" | "D" | "E" | "G")[];
}

export const TIERS: Record<TierId, TierConfig> = {
  easy: {
    bpm: [60, 75],
    description:
      "E and A strings, frets 0–3, natural notes. Fret numbers shown.",
    maxFret: 3,
    name: "Easy",
    naturalsOnly: true,
    notes: 16,
    showFretboard: true,
    showFretHints: true,
    strings: ["E", "A"],
  },
  hard: {
    bpm: [80, 105],
    description:
      "All four strings up to the 12th fret, sharps too. No map: play from memory.",
    maxFret: 12,
    name: "Hard",
    naturalsOnly: false,
    notes: 24,
    showFretboard: false,
    showFretHints: false,
    strings: ["E", "A", "D", "G"],
  },
  medium: {
    bpm: [70, 90],
    description: "All four strings, frets 0–5, natural notes. Names only.",
    maxFret: 5,
    name: "Medium",
    naturalsOnly: true,
    notes: 20,
    showFretboard: true,
    showFretHints: false,
    strings: ["E", "A", "D", "G"],
  },
};

export const TIER_ORDER: TierId[] = ["easy", "medium", "hard"];
export const LEVELS_PER_TIER = 10;

/**
 * Moving one string over counts as this many frets of movement, when
 * measuring how far apart two notes are on the neck.
 */
export const STRING_CHANGE_COST = 2;

/** Hit rate (Perfect + Good, out of all notes) needed for 1, 2 and 3 stars. */
export const STAR_THRESHOLDS = [0.6, 0.8, 0.95];
