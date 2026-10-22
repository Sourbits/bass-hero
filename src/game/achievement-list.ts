import { ACHIEVEMENT_GOALS as GOALS } from "@/config/achievements";
import { LEVELS_PER_TIER, TIER_ORDER, type TierId } from "@/config/difficulty";
import { EAR_TRAINING } from "@/config/ear-training";
import { COMBO } from "@/config/timing";
import { STRINGS } from "@/instrument/bass";
import {
  type AchievementEvent,
  type AchievementStats,
  dayStreak,
  PLAY_MODES,
  type RunMode,
} from "./achievement-stats";
import { type Level, starsFor } from "./difficulty";
import { type NoteStats, WEAK_BELOW } from "./note-stats";
import { type Position, positionKey } from "./positions";
import { levelKey, type Progress } from "./progress";
import { hitRate } from "./review";
import { type ScoreSummary, summarize } from "./score";

/** What's saved, which most achievements are checked against. */
export interface World {
  noteStats: NoteStats;
  /** When the check happens. */
  now: Date;
  progress: Progress;
  stats: AchievementStats;
}

/** A finished run, worked out once for every achievement to look at. */
export interface RunFacts {
  at: Date;
  /** Notes missed for buzzing. */
  buzzMisses: number;
  countBuzz: boolean;
  hitRate: number;
  level: Level | null;
  mode: RunMode;
  stars: number;
  summary: ScoreSummary;
  total: number;
}

export interface AchievementContext extends World {
  event: AchievementEvent;
  /** The run that just finished, if the event is one. */
  run: RunFacts | null;
}

export interface Goal {
  current: number;
  target: number;
}

export type AchievementGroup =
  | "Combos and timing"
  | "Ear training"
  | "Getting started"
  | "Habits"
  | "Knowing the neck"
  | "Levels and stars";

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  "Getting started",
  "Combos and timing",
  "Levels and stars",
  "Knowing the neck",
  "Ear training",
  "Habits",
];

export interface Achievement {
  description: string;
  /** Whether this event, or what's saved, earns it. */
  earned: (context: AchievementContext) => boolean;
  group: AchievementGroup;
  id: string;
  name: string;
  /** How far along you are, for goals that build up. */
  progress?: (world: World) => Goal;
}

export function runFacts(event: AchievementEvent): RunFacts | null {
  if (event.kind !== "run") {
    return null;
  }
  const rate = hitRate(event.judgments, event.total);
  return {
    at: event.at,
    buzzMisses: event.judgments.filter((each) => each?.reason === "buzz")
      .length,
    countBuzz: event.countBuzz,
    hitRate: rate,
    level: event.level,
    mode: event.mode,
    stars: starsFor(rate),
    summary: summarize(event.judgments, event.order),
    total: event.total,
  };
}

/** Stars there are to earn: 3 on every level. */
export const ALL_STARS = TIER_ORDER.length * LEVELS_PER_TIER * 3;
const OPEN_STRINGS: Position[] = STRINGS.map((string) => ({
  fret: 0,
  string,
}));

function frets(strings: readonly Position["string"][], highest: number) {
  return strings.flatMap((string) =>
    Array.from({ length: highest + 1 }, (_, fret) => ({ fret, string }))
  );
}

const E_STRING = frets(["E"], 12);
const FIRST_POSITION = frets(STRINGS, 5);
/** Every position up to the 12th fret. */
export const WHOLE_NECK = frets(STRINGS, 12);

function starsOn(progress: Progress, tier: TierId, level: number) {
  return progress.records[levelKey({ level, tier })]?.stars ?? 0;
}

export function totalStars(progress: Progress) {
  return Object.values(progress.records).reduce(
    (sum, record) => sum + record.stars,
    0
  );
}

/** How many of these positions are green on the heat map. */
export function greens(stats: NoteStats, positions: Position[]): Goal {
  return {
    current: positions.filter(
      (position) => (stats[positionKey(position)]?.mastery ?? 0) >= WEAK_BELOW
    ).length,
    target: positions.length,
  };
}

function reached({ current, target }: Goal) {
  return current >= target;
}

function hits(run: RunFacts | null) {
  return run ? run.summary.counts.perfect + run.summary.counts.good : 0;
}

function clearAchievement(
  id: string,
  name: string,
  tier: TierId,
  level: number,
  group: AchievementGroup = "Levels and stars"
): Achievement {
  const tierName = tier[0]?.toUpperCase() + tier.slice(1);
  return {
    description: `Clear ${tierName} ${level}: earn at least 1 star.`,
    earned: ({ progress }) => starsOn(progress, tier, level) >= 1,
    group,
    id,
    name,
  };
}

function goalAchievement(
  achievement: Omit<Achievement, "earned"> & {
    progress: (world: World) => Goal;
  }
): Achievement {
  return {
    ...achievement,
    earned: (world) => reached(achievement.progress(world)),
  };
}

const COMBO_X2 = COMBO.notesPerStep;
const COMBO_MAX = COMBO.notesPerStep * (COMBO.maxMultiplier - 1);

function isNightOwl(context: AchievementContext) {
  const { event } = context;
  return (
    (event.kind === "run" || event.kind === "ear-round") &&
    event.at.getHours() < GOALS.nightOwlBeforeHour
  );
}

function perfectEarRound(event: AchievementEvent, tiers?: TierId[]) {
  return (
    event.kind === "ear-round" &&
    event.firstTries.length >= EAR_TRAINING.prompts &&
    event.firstTries.every(Boolean) &&
    (!tiers || tiers.includes(event.tier))
  );
}

/** Every achievement, in the order they're listed. */
export const ACHIEVEMENTS: Achievement[] = [
  // Getting started: quick wins for the first sessions.
  {
    description: "Hit your first note.",
    earned: ({ event, run }) =>
      hits(run) > 0 ||
      (event.kind === "ear-round" && event.firstTries.length > 0),
    group: "Getting started",
    id: "first-note",
    name: "First Note",
  },
  {
    description: "Land your first Perfect.",
    earned: ({ run }) => (run?.summary.counts.perfect ?? 0) > 0,
    group: "Getting started",
    id: "spot-on",
    name: "Spot On",
  },
  {
    description: "Get all four strings in tune in the tuner.",
    earned: ({ event }) => event.kind === "tuned",
    group: "Getting started",
    id: "tuned-up",
    name: "Tuned Up",
  },
  {
    description: "Save a latency calibration.",
    earned: ({ event }) => event.kind === "calibrated",
    group: "Getting started",
    id: "dialed-in",
    name: "Dialed In",
  },
  {
    description: "Clear your first level: earn at least 1 star.",
    earned: ({ progress }) => totalStars(progress) > 0,
    group: "Getting started",
    id: "first-clear",
    name: "First Clear",
  },
  goalAchievement({
    description: "Hit all four open strings: E, A, D and G.",
    group: "Getting started",
    id: "open-strings",
    name: "Open Strings",
    progress: ({ noteStats }) => ({
      current: OPEN_STRINGS.filter(
        (position) => (noteStats[positionKey(position)]?.hits ?? 0) > 0
      ).length,
      target: OPEN_STRINGS.length,
    }),
  }),
  {
    description: "Get 3 stars on any level.",
    earned: ({ progress }) =>
      Object.values(progress.records).some((record) => record.stars >= 3),
    group: "Getting started",
    id: "shining-star",
    name: "Shining Star",
  },
  {
    description: "Finish a Practice run.",
    earned: ({ run }) => run?.mode === "practice",
    group: "Getting started",
    id: "free-play",
    name: "Free Play",
  },
  {
    description: "Finish a Weak spots run.",
    earned: ({ run }) => run?.mode === "weak-spots",
    group: "Getting started",
    id: "self-aware",
    name: "Self Aware",
  },
  {
    description: "Find an ear training note on the first try.",
    earned: ({ event }) =>
      event.kind === "ear-round" && event.firstTries.some(Boolean),
    group: "Getting started",
    id: "first-listen",
    name: "First Listen",
  },
  clearAchievement(
    "halfway-there",
    "Halfway There",
    "easy",
    5,
    "Getting started"
  ),
  goalAchievement({
    description: `Play ${GOALS.centuryNotes} notes.`,
    group: "Getting started",
    id: "century",
    name: "Century",
    progress: ({ stats }) => ({
      current: stats.notesPlayed,
      target: GOALS.centuryNotes,
    }),
  }),
  goalAchievement({
    description: "Play Levels, Practice, Weak spots and Ear training.",
    group: "Getting started",
    id: "explorer",
    name: "Explorer",
    progress: ({ stats }) => ({
      current: stats.modesPlayed.length,
      target: PLAY_MODES.length,
    }),
  }),
  {
    description: "Sign in, so your progress is saved to an account.",
    earned: ({ event }) => event.kind === "signed-in",
    group: "Getting started",
    id: "safe-keeping",
    name: "Safe Keeping",
  },

  // Combos and timing.
  {
    description: `${COMBO_X2} hits in a row, reaching ×2.`,
    earned: ({ run }) => (run?.summary.maxStreak ?? 0) >= COMBO_X2,
    group: "Combos and timing",
    id: "warmed-up",
    name: "Warmed Up",
  },
  {
    description: `${COMBO_MAX} hits in a row, reaching ×${COMBO.maxMultiplier}.`,
    earned: ({ run }) => (run?.summary.maxStreak ?? 0) >= COMBO_MAX,
    group: "Combos and timing",
    id: "on-fire",
    name: "On Fire",
  },
  {
    description: `${GOALS.unstoppableStreak} hits in a row.`,
    earned: ({ run }) =>
      (run?.summary.maxStreak ?? 0) >= GOALS.unstoppableStreak,
    group: "Combos and timing",
    id: "unstoppable",
    name: "Unstoppable",
  },
  {
    description: "Finish a level without a single miss.",
    earned: ({ run }) =>
      run?.mode === "level" && hits(run) === run.total && run.total > 0,
    group: "Combos and timing",
    id: "full-combo",
    name: "Full Combo",
  },
  {
    description: "Finish a level with every note Perfect.",
    earned: ({ run }) =>
      run?.mode === "level" &&
      run.total > 0 &&
      run.summary.counts.perfect === run.total,
    group: "Combos and timing",
    id: "perfectionist",
    name: "Perfectionist",
  },
  {
    description:
      "Earn 2 stars or more on a level with buzz checking on, without one buzzing note.",
    earned: ({ run }) =>
      run?.mode === "level" &&
      run.countBuzz &&
      run.stars >= 2 &&
      run.buzzMisses === 0,
    group: "Combos and timing",
    id: "clean-hands",
    name: "Clean Hands",
  },
  {
    description: `Average within ±${GOALS.metronomeMaxMs} ms of the beat over a run of ${GOALS.metronomeMinHits}+ hits.`,
    earned: ({ run }) =>
      hits(run) >= GOALS.metronomeMinHits &&
      Math.abs(run?.summary.averageOffsetMs ?? Number.POSITIVE_INFINITY) <=
        GOALS.metronomeMaxMs,
    group: "Combos and timing",
    id: "metronome",
    name: "Metronome",
  },

  // Levels and stars.
  clearAchievement("easy-does-it", "Easy Does It", "easy", 10),
  clearAchievement("getting-serious", "Getting Serious", "medium", 10),
  clearAchievement("hard-rock", "Hard Rock", "hard", 10),
  clearAchievement("demon-slayer", "Demon Slayer", "demon", 1),
  {
    description: "Get 3 stars on Demon 10.",
    earned: ({ progress }) => starsOn(progress, "demon", 10) >= 3,
    group: "Levels and stars",
    id: "demon-lord",
    name: "Demon Lord",
  },
  goalAchievement({
    description: `Earn ${GOALS.starCollector} stars.`,
    group: "Levels and stars",
    id: "star-collector",
    name: "Star Collector",
    progress: ({ progress }) => ({
      current: totalStars(progress),
      target: GOALS.starCollector,
    }),
  }),
  goalAchievement({
    description: `Earn all ${ALL_STARS} stars.`,
    group: "Levels and stars",
    id: "all-the-stars",
    name: "All the Stars",
    progress: ({ progress }) => ({
      current: totalStars(progress),
      target: ALL_STARS,
    }),
  }),

  // Knowing the neck, from the heat map.
  goalAchievement({
    description:
      "Every note on the E string, up to the 12th fret, green on the heat map.",
    group: "Knowing the neck",
    id: "know-your-e",
    name: "Know Your E",
    progress: ({ noteStats }) => greens(noteStats, E_STRING),
  }),
  goalAchievement({
    description: "Every note on frets 0 to 5 green on the heat map.",
    group: "Knowing the neck",
    id: "first-position",
    name: "First Position",
    progress: ({ noteStats }) => greens(noteStats, FIRST_POSITION),
  }),
  goalAchievement({
    description: "Every note up to the 12th fret green on the heat map.",
    group: "Knowing the neck",
    id: "whole-neck",
    name: "Whole Neck",
    progress: ({ noteStats }) => greens(noteStats, WHOLE_NECK),
  }),
  {
    description: `Finish a Weak spots run with ${Math.round(GOALS.noWeakSpotsHitRate * 100)}% or more.`,
    earned: ({ run }) =>
      run?.mode === "weak-spots" && run.hitRate >= GOALS.noWeakSpotsHitRate,
    group: "Knowing the neck",
    id: "no-weak-spots",
    name: "No Weak Spots",
  },

  // Ear training.
  {
    description: `${EAR_TRAINING.prompts} of ${EAR_TRAINING.prompts} on the first try in an ear training round.`,
    earned: ({ event }) => perfectEarRound(event),
    group: "Ear training",
    id: "good-ears",
    name: "Good Ears",
  },
  {
    description: `${EAR_TRAINING.prompts} of ${EAR_TRAINING.prompts} on the first try in a Hard or Demon round.`,
    earned: ({ event }) => perfectEarRound(event, ["hard", "demon"]),
    group: "Ear training",
    id: "golden-ears",
    name: "Golden Ears",
  },
  goalAchievement({
    description: `${GOALS.earStreak} first-try answers in a row, across rounds.`,
    group: "Ear training",
    id: "ear-streak",
    name: "Ear Streak",
    progress: ({ stats }) => ({
      current: stats.bestEarStreak,
      target: GOALS.earStreak,
    }),
  }),

  // Habits.
  goalAchievement({
    description: `Play on ${GOALS.dailyPracticeDays} days in a row.`,
    group: "Habits",
    id: "daily-practice",
    name: "Daily Practice",
    progress: ({ now, stats }) => ({
      current: dayStreak(stats.playDays, now),
      target: GOALS.dailyPracticeDays,
    }),
  }),
  goalAchievement({
    description: `Play on ${GOALS.weeklyHabitDays} days in a row.`,
    group: "Habits",
    id: "weekly-habit",
    name: "Weekly Habit",
    progress: ({ now, stats }) => ({
      current: dayStreak(stats.playDays, now),
      target: GOALS.weeklyHabitDays,
    }),
  }),
  goalAchievement({
    description: `Play ${GOALS.marathonNotes.toLocaleString("en-US")} notes.`,
    group: "Habits",
    id: "marathon",
    name: "Marathon",
    progress: ({ stats }) => ({
      current: stats.notesPlayed,
      target: GOALS.marathonNotes,
    }),
  }),
  {
    description: `Finish a run between midnight and ${GOALS.nightOwlBeforeHour} am.`,
    earned: isNightOwl,
    group: "Habits",
    id: "night-owl",
    name: "Night Owl",
  },
];

const BY_ID = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement])
);

/** The achievement with this id, if there is one. */
export function findAchievement(id: string) {
  return BY_ID.get(id);
}
