import type { TierId } from "@/config/difficulty";
import type { Judgment } from "@/timing/judge";
import type { Level } from "./difficulty";

/** The game modes that run notes down the highway. */
export type RunMode = "level" | "practice" | "weak-spots";
/** Every mode that counts toward Explorer. */
export type PlayMode = RunMode | "ear-training";

export const PLAY_MODES: PlayMode[] = [
  "level",
  "practice",
  "weak-spots",
  "ear-training",
];

/** Something that happened that might unlock an achievement. */
export type AchievementEvent =
  | {
      at: Date;
      countBuzz: boolean;
      judgments: (Judgment | undefined)[];
      kind: "run";
      /** The level played, in Levels mode. */
      level: Level | null;
      mode: RunMode;
      /** Note indexes in the order they were judged. */
      order: number[];
      /** Notes in the chart. */
      total: number;
    }
  | {
      at: Date;
      /** For each note of the round, whether it was found on the first try. */
      firstTries: boolean[];
      kind: "ear-round";
      tier: TierId;
    }
  /** Nothing new happened: just check saved progress, for example on load. */
  | { kind: "calibrated" }
  | { kind: "check" }
  | { kind: "signed-in" }
  | { kind: "tuned" };

/** Running totals some achievements need. */
export interface AchievementStats {
  /** The most first-try ear training answers in a row, ever. */
  bestEarStreak: number;
  /** First-try ear training answers in a row right now, across rounds. */
  earStreak: number;
  /** Modes finished at least once. */
  modesPlayed: PlayMode[];
  /** Notes played through in finished runs and ear training rounds. */
  notesPlayed: number;
  /** Recent days played on, as local dates such as "2026-10-20", in order. */
  playDays: string[];
}

export const EMPTY_STATS: AchievementStats = {
  bestEarStreak: 0,
  earStreak: 0,
  modesPlayed: [],
  notesPlayed: 0,
  playDays: [],
};

/** Days kept in playDays: enough for the longest day streak goal. */
const DAYS_KEPT = 14;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A local date such as "2026-10-20". */
export function localDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayBefore(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year ?? 0, (month ?? 1) - 1, (date ?? 1) - 1));
}

function addDays(days: string[], more: string[]) {
  return [...new Set([...days, ...more])].sort().slice(-DAYS_KEPT);
}

/**
 * Days in a row played, up to the latest day played. Given today, a streak
 * that ended before yesterday counts as broken.
 */
export function dayStreak(days: string[], today?: Date) {
  const playedOn = new Set(days);
  let day = days.at(-1);
  if (!day) {
    return 0;
  }
  if (today) {
    const now = localDay(today);
    if (day !== now && day !== dayBefore(now)) {
      return 0;
    }
  }
  let streak = 0;
  while (day && playedOn.has(day)) {
    streak += 1;
    day = dayBefore(day);
  }
  return streak;
}

function played(
  stats: AchievementStats,
  mode: PlayMode,
  notes: number,
  at: Date
) {
  return {
    ...stats,
    modesPlayed: PLAY_MODES.filter(
      (each) => each === mode || stats.modesPlayed.includes(each)
    ),
    notesPlayed: stats.notesPlayed + notes,
    playDays: addDays(stats.playDays, [localDay(at)]),
  };
}

/** The running totals after an event. */
export function updateStats(
  stats: AchievementStats,
  event: AchievementEvent
): AchievementStats {
  if (event.kind === "run") {
    return played(stats, event.mode, event.total, event.at);
  }
  if (event.kind !== "ear-round") {
    return stats;
  }
  let { bestEarStreak, earStreak } = stats;
  for (const firstTry of event.firstTries) {
    earStreak = firstTry ? earStreak + 1 : 0;
    bestEarStreak = Math.max(bestEarStreak, earStreak);
  }
  return {
    ...played(stats, "ear-training", event.firstTries.length, event.at),
    bestEarStreak,
    earStreak,
  };
}

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/** Reads stats from saved JSON, dropping anything that doesn't fit. */
export function parseStats(value: unknown): AchievementStats {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof AchievementStats, unknown>>)
      : {};
  const modes = Array.isArray(raw.modesPlayed) ? raw.modesPlayed : [];
  const days = Array.isArray(raw.playDays) ? raw.playDays : [];
  return {
    bestEarStreak: count(raw.bestEarStreak),
    earStreak: count(raw.earStreak),
    modesPlayed: PLAY_MODES.filter((mode) => modes.includes(mode)),
    notesPlayed: count(raw.notesPlayed),
    playDays: addDays(
      [],
      days.filter(
        (day): day is string => typeof day === "string" && DAY.test(day)
      )
    ),
  };
}

/**
 * Combines two devices' stats. Totals can't be added without counting the
 * same notes twice, so the bigger one wins; the current ear streak comes
 * from the newer copy.
 */
export function mergeStats(
  older: AchievementStats,
  newer: AchievementStats
): AchievementStats {
  return {
    bestEarStreak: Math.max(older.bestEarStreak, newer.bestEarStreak),
    earStreak: newer.earStreak,
    modesPlayed: PLAY_MODES.filter(
      (mode) =>
        older.modesPlayed.includes(mode) || newer.modesPlayed.includes(mode)
    ),
    notesPlayed: Math.max(older.notesPlayed, newer.notesPlayed),
    playDays: addDays(older.playDays, newer.playDays),
  };
}
