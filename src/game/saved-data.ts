import { type NoteStat, type NoteStats, parseNoteStats } from "./note-stats";
import { type PracticeSetting, parsePractice } from "./practice-setting";
import { type LevelRecord, type Progress, parseProgress } from "./progress";
import { parseTempo } from "./tempo-setting";

/**
 * Everything saved to an account: level progress, the heat map stats and
 * Practice settings. The latency offset isn't here on purpose: it belongs to
 * a device's mic and speakers, not to the player.
 */
export interface SavedData {
  noteStats: NoteStats;
  practice: PracticeSetting | null;
  progress: Progress;
  tempo: number | null;
  /** When this data last changed, in ms since 1970. */
  updatedAt: number;
  version: 1;
}

/** Biggest saved data the server accepts, in bytes of JSON. */
export const MAX_SAVED_DATA_BYTES = 256 * 1024;

export const EMPTY_SAVED_DATA: SavedData = {
  noteStats: {},
  practice: null,
  progress: parseProgress(null),
  tempo: null,
  updatedAt: 0,
  version: 1,
};

/** Reads saved data from JSON, or null if it isn't saved data at all. */
export function parseSavedData(value: unknown): SavedData | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Partial<Record<keyof SavedData, unknown>>;
  if (raw.version !== 1) {
    return null;
  }
  const updatedAt = Number(raw.updatedAt);
  return {
    noteStats: parseNoteStats(raw.noteStats),
    practice: raw.practice ? parsePractice(raw.practice) : null,
    progress: parseProgress(raw.progress),
    tempo: parseTempo(raw.tempo),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    version: 1,
  };
}

function bestRecord(
  a: LevelRecord | undefined,
  b: LevelRecord | undefined
): LevelRecord | undefined {
  if (!(a && b)) {
    return a ?? b;
  }
  return {
    bestHitRate: Math.max(a.bestHitRate, b.bestHitRate),
    bestScore: Math.max(a.bestScore, b.bestScore),
    stars: Math.max(a.stars, b.stars),
  };
}

/** For each note, the stats with more plays behind them. */
export function mergeNoteStats(a: NoteStats, b: NoteStats): NoteStats {
  const merged: NoteStats = { ...a };
  for (const [key, stat] of Object.entries(b)) {
    const mine: NoteStat | undefined = merged[key];
    if (stat && (!mine || stat.attempts > mine.attempts)) {
      merged[key] = stat;
    }
  }
  return merged;
}

/**
 * Combines two copies of saved data, such as a guest's progress and their
 * account's, or two devices'. Bests are kept from both; choices like the
 * current level and settings come from whichever copy changed last.
 */
export function mergeSavedData(a: SavedData, b: SavedData): SavedData {
  const [older, newer] = a.updatedAt > b.updatedAt ? [b, a] : [a, b];
  const records: Record<string, LevelRecord> = {};
  for (const key of new Set([
    ...Object.keys(older.progress.records),
    ...Object.keys(newer.progress.records),
  ])) {
    const record = bestRecord(
      older.progress.records[key],
      newer.progress.records[key]
    );
    if (record) {
      records[key] = record;
    }
  }

  return {
    noteStats: mergeNoteStats(older.noteStats, newer.noteStats),
    practice: newer.practice ?? older.practice,
    progress: { ...newer.progress, records },
    tempo: newer.tempo ?? older.tempo,
    updatedAt: newer.updatedAt,
    version: 1,
  };
}
