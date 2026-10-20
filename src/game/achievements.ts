import { ACHIEVEMENTS, runFacts, type World } from "./achievement-list";
import {
  type AchievementEvent,
  type AchievementStats,
  EMPTY_STATS,
  mergeStats,
  parseStats,
  updateStats,
} from "./achievement-stats";
import { loadNoteStats } from "./note-stats";
import { loadProgress } from "./progress";
import { markLocalChange } from "./storage-events";

export const ACHIEVEMENTS_STORAGE_KEY = "bass-hero:achievements";
/** Achievements were just unlocked; the event's detail lists their ids. */
export const ACHIEVEMENTS_UNLOCKED_EVENT = "bass-hero:achievements-unlocked";

export interface AchievementRecord {
  stats: AchievementStats;
  /** When each achievement was unlocked, by id, in ms since 1970. */
  unlocked: Partial<Record<string, number>>;
}

export const EMPTY_ACHIEVEMENTS: AchievementRecord = {
  stats: EMPTY_STATS,
  unlocked: {},
};

const KNOWN_IDS = new Set(ACHIEVEMENTS.map(({ id }) => id));

/**
 * Takes in one event: updates the running totals, then unlocks whatever the
 * event or the saved progress now earns. Returns the new record and the ids
 * unlocked just now, in list order.
 */
export function applyEvent(
  record: AchievementRecord,
  event: AchievementEvent,
  world: Omit<World, "stats">
): { record: AchievementRecord; unlocked: string[] } {
  const stats = updateStats(record.stats, event);
  const context = { ...world, event, run: runFacts(event), stats };
  const unlocked = ACHIEVEMENTS.filter(
    ({ earned, id }) => !record.unlocked[id] && earned(context)
  ).map(({ id }) => id);
  const at = world.now.getTime();
  return {
    record: {
      stats,
      unlocked: {
        ...record.unlocked,
        ...Object.fromEntries(unlocked.map((id) => [id, at])),
      },
    },
    unlocked,
  };
}

/** Reads achievements from saved JSON, dropping anything that doesn't fit. */
export function parseAchievements(value: unknown): AchievementRecord {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof AchievementRecord, unknown>>)
      : {};
  const unlocked: AchievementRecord["unlocked"] = {};
  if (raw.unlocked && typeof raw.unlocked === "object") {
    for (const [id, at] of Object.entries(raw.unlocked)) {
      if (KNOWN_IDS.has(id) && typeof at === "number" && at > 0) {
        unlocked[id] = at;
      }
    }
  }
  return { stats: parseStats(raw.stats), unlocked };
}

/** Combines two devices' achievements: everything unlocked on either. */
export function mergeAchievements(
  older: AchievementRecord,
  newer: AchievementRecord
): AchievementRecord {
  const unlocked = { ...older.unlocked };
  for (const [id, at] of Object.entries(newer.unlocked)) {
    const mine = unlocked[id];
    if (at && (!mine || at < mine)) {
      unlocked[id] = at;
    }
  }
  return { stats: mergeStats(older.stats, newer.stats), unlocked };
}

/** Achievements saved in this browser. */
export function loadAchievements(): AchievementRecord {
  try {
    return parseAchievements(
      JSON.parse(
        window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY) ?? "null"
      )
    );
  } catch {
    return EMPTY_ACHIEVEMENTS;
  }
}

function saveAchievements(record: AchievementRecord) {
  try {
    window.localStorage.setItem(
      ACHIEVEMENTS_STORAGE_KEY,
      JSON.stringify(record)
    );
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  markLocalChange();
}

/**
 * Tells the achievements something happened. Call it after saving the run's
 * own progress, so the check sees it. Returns the ids unlocked just now, and
 * announces them for the pop-ups.
 */
export function reportAchievement(event: AchievementEvent) {
  if (typeof window === "undefined") {
    return [];
  }
  const before = loadAchievements();
  const { record, unlocked } = applyEvent(before, event, {
    noteStats: loadNoteStats(),
    now: new Date(),
    progress: loadProgress(),
  });
  if (unlocked.length > 0 || record.stats !== before.stats) {
    saveAchievements(record);
  }
  if (unlocked.length > 0) {
    window.dispatchEvent(
      new CustomEvent<string[]>(ACHIEVEMENTS_UNLOCKED_EVENT, {
        detail: unlocked,
      })
    );
  }
  return unlocked;
}

/** Calls back with the ids of achievements as they're unlocked. */
export function onAchievementsUnlocked(callback: (ids: string[]) => void) {
  const listener = (event: Event) => {
    if (event instanceof CustomEvent && Array.isArray(event.detail)) {
      callback(event.detail as string[]);
    }
  };
  window.addEventListener(ACHIEVEMENTS_UNLOCKED_EVENT, listener);
  return () =>
    window.removeEventListener(ACHIEVEMENTS_UNLOCKED_EVENT, listener);
}
