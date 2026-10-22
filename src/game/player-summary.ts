import { LEVELS_PER_TIER, TIER_ORDER } from "@/config/difficulty";
import {
  ACHIEVEMENTS,
  ALL_STARS,
  type Goal,
  greens,
  totalStars,
  WHOLE_NECK,
} from "./achievement-list";
import { dayStreak } from "./achievement-stats";
import type { Level } from "./difficulty";
import { levelKey } from "./progress";
import type { SavedData } from "./saved-data";

/** What friends see of a player: overall stats and achievements. */
export interface PlayerSummary {
  /** Unlocked achievements, newest first, with when (ms since 1970). */
  achievements: { at: number; id: string }[];
  achievementsTotal: number;
  bestEarStreak: number;
  /** Days in a row played, up to today or yesterday. */
  dayStreak: number;
  /** The hardest level cleared (1 star or more), or null for none yet. */
  furthest: Level | null;
  /** When their progress last changed, or null if it never has. */
  lastPlayedAt: number | null;
  levelsCleared: number;
  /** Notes up to the 12th fret that are green on their heat map. */
  notesKnown: Goal;
  notesPlayed: number;
  stars: Goal;
}

/** Sums up a player's saved data for their friends to see. */
export function summarizePlayer(data: SavedData, now: Date): PlayerSummary {
  const { achievements, noteStats, progress } = data;
  let furthest: Level | null = null;
  let levelsCleared = 0;
  for (const tier of TIER_ORDER) {
    for (let level = 1; level <= LEVELS_PER_TIER; level += 1) {
      if ((progress.records[levelKey({ level, tier })]?.stars ?? 0) > 0) {
        furthest = { level, tier };
        levelsCleared += 1;
      }
    }
  }
  return {
    achievements: Object.entries(achievements.unlocked)
      .flatMap(([id, at]) => (at ? [{ at, id }] : []))
      .sort((a, b) => b.at - a.at),
    achievementsTotal: ACHIEVEMENTS.length,
    bestEarStreak: achievements.stats.bestEarStreak,
    dayStreak: dayStreak(achievements.stats.playDays, now),
    furthest,
    lastPlayedAt: data.updatedAt > 0 ? data.updatedAt : null,
    levelsCleared,
    notesKnown: greens(noteStats, WHOLE_NECK),
    notesPlayed: achievements.stats.notesPlayed,
    stars: { current: totalStars(progress), target: ALL_STARS },
  };
}
