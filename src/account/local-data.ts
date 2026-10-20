import { loadNoteStats, NOTE_STATS_STORAGE_KEY } from "@/game/note-stats";
import { loadPractice, PRACTICE_STORAGE_KEY } from "@/game/practice-setting";
import { loadProgress, PROGRESS_STORAGE_KEY } from "@/game/progress";
import type { SavedData } from "@/game/saved-data";
import { DATA_REPLACED_EVENT, UPDATED_AT_KEY } from "@/game/storage-events";
import { loadTempo, TEMPO_STORAGE_KEY } from "@/game/tempo-setting";

/** Every saved-data key an account covers. The latency offset isn't one. */
const ACCOUNT_KEYS = [
  NOTE_STATS_STORAGE_KEY,
  PRACTICE_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  TEMPO_STORAGE_KEY,
  UPDATED_AT_KEY,
];

function has(key: string) {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/** This browser's saved data, as an account stores it. */
export function collectLocalData(): SavedData {
  let updatedAt = 0;
  try {
    updatedAt = Number(window.localStorage.getItem(UPDATED_AT_KEY)) || 0;
  } catch {
    updatedAt = 0;
  }
  return {
    noteStats: loadNoteStats(),
    practice: has(PRACTICE_STORAGE_KEY) ? loadPractice() : null,
    progress: loadProgress(),
    tempo: has(TEMPO_STORAGE_KEY) ? loadTempo() : null,
    updatedAt,
    version: 1,
  };
}

function writeAll(entries: [string, string | null][]) {
  try {
    for (const [key, value] of entries) {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    }
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  window.dispatchEvent(new Event(DATA_REPLACED_EVENT));
}

/**
 * Replaces this browser's saved data with the account's, and tells open
 * screens to reload it.
 */
export function replaceLocalData(data: SavedData) {
  writeAll([
    [NOTE_STATS_STORAGE_KEY, JSON.stringify(data.noteStats)],
    [
      PRACTICE_STORAGE_KEY,
      data.practice ? JSON.stringify(data.practice) : null,
    ],
    [PROGRESS_STORAGE_KEY, JSON.stringify(data.progress)],
    [TEMPO_STORAGE_KEY, data.tempo === null ? null : String(data.tempo)],
    [UPDATED_AT_KEY, String(data.updatedAt)],
  ]);
}

/**
 * Forgets this browser's copy of the account's data, on sign-out, so the
 * next person here starts fresh. It's still safe in the account.
 */
export function clearLocalData() {
  writeAll(ACCOUNT_KEYS.map((key) => [key, null]));
}
