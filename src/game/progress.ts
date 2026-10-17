import { LEVELS_PER_TIER, TIER_ORDER, type TierId } from "@/config/difficulty";
import { type Level, starsFor } from "./difficulty";

const STORAGE_KEY = "bass-hero:progress";

export interface LevelRecord {
  /** Best share of notes hit (Perfect or Good), from 0 to 1. */
  bestHitRate: number;
  bestScore: number;
  /** Best stars earned, 0 to 3. */
  stars: number;
}

export interface GameOptions {
  /** Count a buzzing note as a Miss. */
  countBuzz: boolean;
  /** Play each note out loud as it lands. Meant for headphones. */
  guideTone: boolean;
  /** Show the fretboard map on tiers that hide it by default. */
  showFretboardAlways: boolean;
}

export interface Progress {
  /** The level picked last. */
  current: Level;
  options: GameOptions;
  /** Best results, by levelKey(). */
  records: Record<string, LevelRecord>;
}

export const NEW_PROGRESS: Progress = {
  current: { level: 1, tier: "easy" },
  options: { countBuzz: true, guideTone: false, showFretboardAlways: false },
  records: {},
};

export function levelKey({ level, tier }: Level) {
  return `${tier}-${level}`;
}

/** Keeps the better of each best, after a run. Returns new progress. */
export function recordRun(
  progress: Progress,
  level: Level,
  { hitRate, score }: { hitRate: number; score: number }
): Progress {
  const key = levelKey(level);
  const before = progress.records[key];
  return {
    ...progress,
    records: {
      ...progress.records,
      [key]: {
        bestHitRate: Math.max(before?.bestHitRate ?? 0, hitRate),
        bestScore: Math.max(before?.bestScore ?? 0, score),
        stars: Math.max(before?.stars ?? 0, starsFor(hitRate)),
      },
    },
  };
}

/** The level after this one: the next level, or level 1 of the next tier. */
export function nextLevel({ level, tier }: Level): Level | null {
  if (level < LEVELS_PER_TIER) {
    return { level: level + 1, tier };
  }
  const nextTier: TierId | undefined = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1];
  return nextTier ? { level: 1, tier: nextTier } : null;
}

function isLevel(value: unknown): value is Level {
  if (!value || typeof value !== "object") {
    return false;
  }
  const { level, tier } = value as Partial<Level>;
  return (
    typeof level === "number" &&
    level >= 1 &&
    level <= LEVELS_PER_TIER &&
    tier !== undefined &&
    TIER_ORDER.includes(tier)
  );
}

/** Progress saved in this browser, or a fresh start. */
export function loadProgress(): Progress {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null"
    ) as Partial<Progress> | null;
    return {
      current: isLevel(saved?.current) ? saved.current : NEW_PROGRESS.current,
      options: { ...NEW_PROGRESS.options, ...saved?.options },
      records:
        saved?.records && typeof saved.records === "object"
          ? saved.records
          : {},
    };
  } catch {
    return NEW_PROGRESS;
  }
}

export function saveProgress(progress: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be blocked, for example in a private window.
  }
}
