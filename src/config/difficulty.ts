/**
 * The game's difficulty curve, all in one place to tune. It starts with two
 * open strings at a crawl and ends in Demon. Every value given as a pair is
 * [level 1, level 10]; the levels in between are spread evenly.
 */

export type TierId = "demon" | "easy" | "hard" | "medium";

export interface TierConfig {
  /**
   * Beats from one note to the next: 2 is every other beat, 0.5 is two notes
   * per beat. Snapped to 2, 1½, 1, ¾ or ½.
   */
  beatsPerNote: [number, number];
  /** Tempo, in BPM. */
  bpm: [number, number];
  description: string;
  /** How far each note may move from the last, as the same kind of share. */
  maxJump: [number, number];
  /**
   * How far each note must move from the last, as a share of the widest
   * move the level's notes allow. 0 allows repeats.
   */
  minJump: [number, number];
  name: string;
  /** Notes per run: later levels run longer. */
  notes: [number, number];
  /**
   * Every note the tier uses, as string and fret ("E3" is the E string's 3rd
   * fret), in the order they're introduced: a level uses the first few, and
   * level 10 uses them all.
   */
  pool: string[];
  /** Show the fretboard map under the highway. Off: play from memory. */
  showFretboard: boolean;
  /** Write the fret number under each note on the highway. */
  showFretHints: boolean;
  /** How many of the pool's notes level 1 uses. */
  startNotes: number;
  /** Tighter timing windows than the defaults in timing.ts, in ms. */
  timing?: { goodWindowMs: number; perfectWindowMs: number };
}

/** Open strings first, then the natural notes on frets 1–3. */
const EASY_POOL = ["E0", "A0", "D0", "G0", "E3", "A3", "D2", "G2", "E1", "A2"];
/** The rest of the natural notes up to fret 5. */
const MEDIUM_POOL = [...EASY_POOL, "D3", "G4", "E5", "A5", "D5", "G5"];
/** Sharps up to fret 5, then every note on frets 6 and 7. */
const HARD_POOL = [
  ...MEDIUM_POOL,
  ...["E2", "A1", "D1", "G1", "E4", "A4", "D4", "G3"],
  ...["E6", "A6", "D6", "G6", "E7", "A7", "D7", "G7"],
];
/** Every note up to the 12th fret. */
const DEMON_POOL = ["E", "A", "D", "G"].flatMap((string) =>
  Array.from({ length: 13 }, (_, fret) => `${string}${fret}`)
);

export const TIERS: Record<TierId, TierConfig> = {
  demon: {
    beatsPerNote: [0.5, 0.5],
    bpm: [100, 150],
    description:
      "Every note to the 12th fret, two per beat, huge jumps, tighter timing (Perfect ±35 ms, Good ±80 ms). No help at all.",
    maxJump: [1, 1],
    minJump: [0.3, 0.5],
    name: "Demon",
    notes: [128, 256],
    pool: DEMON_POOL,
    showFretboard: false,
    showFretHints: false,
    startNotes: DEMON_POOL.length,
    timing: { goodWindowMs: 80, perfectWindowMs: 35 },
  },
  easy: {
    beatsPerNote: [2, 1],
    bpm: [50, 70],
    description:
      "Starts with the open E and A strings, slowly, and adds a note almost every level, up to the 3rd fret. Fret numbers shown.",
    maxJump: [0.5, 1],
    minJump: [0, 0],
    name: "Easy",
    notes: [12, 32],
    pool: EASY_POOL,
    showFretboard: true,
    showFretHints: true,
    startNotes: 2,
  },
  hard: {
    beatsPerNote: [1, 1],
    bpm: [95, 120],
    description:
      "Adds the sharps, then frets 6 and 7, with notes always on the move. No map: play from memory.",
    maxJump: [0.6, 1],
    minJump: [0.1, 0.35],
    name: "Hard",
    notes: [72, 112],
    pool: HARD_POOL,
    showFretboard: false,
    showFretHints: false,
    startNotes: MEDIUM_POOL.length,
  },
  medium: {
    beatsPerNote: [1, 1],
    bpm: [70, 95],
    description:
      "All the natural notes up to the 5th fret on all four strings. Names only, with the map below.",
    maxJump: [0.4, 1],
    minJump: [0, 0.25],
    name: "Medium",
    notes: [40, 64],
    pool: MEDIUM_POOL,
    showFretboard: true,
    showFretHints: false,
    startNotes: EASY_POOL.length,
  },
};

export const TIER_ORDER: TierId[] = ["easy", "medium", "hard", "demon"];
export const LEVELS_PER_TIER = 10;

/**
 * Moving one string over counts as this many frets of movement, when
 * measuring how far apart two notes are on the neck.
 */
export const STRING_CHANGE_COST = 2;

/** Hit rate (Perfect + Good, out of all notes) needed for 1, 2 and 3 stars. */
export const STAR_THRESHOLDS = [0.6, 0.8, 0.95];
