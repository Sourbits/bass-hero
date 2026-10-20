import type { Judgment } from "@/timing/judge";
import type { ScheduledNote } from "./chart";
import { type Position, positionKey } from "./positions";
import { markLocalChange } from "./storage-events";

export const NOTE_STATS_STORAGE_KEY = "bass-hero:note-stats";
/** Each new result moves a note's mastery this far toward 1 (hit) or 0 (miss). */
const LEARNING_RATE = 0.3;
/** Mastery a note starts from before its first result. */
const STARTING_MASTERY = 0.5;
/** Below this mastery, a note counts as a weak spot. */
export const WEAK_BELOW = 0.85;

export interface NoteStat {
  attempts: number;
  hits: number;
  /**
   * How well you know the note, from 0 to 1. Recent results count most, so
   * it rises as you learn the note and falls if you start missing it.
   */
  mastery: number;
}

/** Results for every note played so far, by position key ("E3"). */
export type NoteStats = Partial<Record<string, NoteStat>>;

export interface Outcome {
  hit: boolean;
  position: Position;
}

/** Adds results to the stats. Returns new stats; the old ones don't change. */
export function recordOutcomes(
  stats: NoteStats,
  outcomes: Outcome[]
): NoteStats {
  const next = { ...stats };
  for (const { hit, position } of outcomes) {
    const key = positionKey(position);
    const before = next[key] ?? {
      attempts: 0,
      hits: 0,
      mastery: STARTING_MASTERY,
    };
    next[key] = {
      attempts: before.attempts + 1,
      hits: before.hits + (hit ? 1 : 0),
      mastery:
        before.mastery + LEARNING_RATE * ((hit ? 1 : 0) - before.mastery),
    };
  }
  return next;
}

/** One result per judged note of a run: Perfect and Good are hits. */
export function outcomesFromRun(
  notes: ScheduledNote[],
  judgments: (Judgment | undefined)[]
): Outcome[] {
  return notes.flatMap((note, index) => {
    const judgment = judgments[index];
    return judgment
      ? [
          {
            hit: judgment.rating !== "miss",
            position: { fret: note.fret, string: note.string },
          },
        ]
      : [];
  });
}

/**
 * The notes to practice most: played notes below the weak-spot line, weakest
 * first, then notes from `fillFrom` not played yet, up to `count`.
 */
export function weakSpots(
  stats: NoteStats,
  fillFrom: Position[],
  count = 8
): Position[] {
  const weak = Object.entries(stats)
    .flatMap(([key, stat]) =>
      stat && stat.mastery < WEAK_BELOW ? [{ key, stat }] : []
    )
    .sort(
      (a, b) =>
        a.stat.mastery - b.stat.mastery || b.stat.attempts - a.stat.attempts
    )
    .map(({ key }) => ({
      fret: Number(key.slice(1)),
      string: key[0] as Position["string"],
    }));
  const unplayed = fillFrom.filter((position) => !stats[positionKey(position)]);
  return [...weak, ...unplayed].slice(0, count);
}

const POSITION_KEY = /^[EADG]([0-9]|1[0-2])$/;

function isNoteStat(value: unknown): value is NoteStat {
  if (!value || typeof value !== "object") {
    return false;
  }
  const { attempts, hits, mastery } = value as Partial<NoteStat>;
  return (
    typeof attempts === "number" &&
    Number.isInteger(attempts) &&
    attempts >= 0 &&
    typeof hits === "number" &&
    Number.isInteger(hits) &&
    hits >= 0 &&
    hits <= attempts &&
    typeof mastery === "number" &&
    mastery >= 0 &&
    mastery <= 1
  );
}

/** Reads stats from saved JSON, keeping only well-formed entries. */
export function parseNoteStats(value: unknown): NoteStats {
  const stats: NoteStats = {};
  if (value && typeof value === "object") {
    for (const [key, stat] of Object.entries(value)) {
      if (POSITION_KEY.test(key) && isNoteStat(stat)) {
        stats[key] = stat;
      }
    }
  }
  return stats;
}

/** Stats saved in this browser. */
export function loadNoteStats(): NoteStats {
  try {
    return parseNoteStats(
      JSON.parse(window.localStorage.getItem(NOTE_STATS_STORAGE_KEY) ?? "{}")
    );
  } catch {
    return {};
  }
}

export function saveNoteStats(stats: NoteStats) {
  try {
    window.localStorage.setItem(NOTE_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  markLocalChange();
}

/** Records a run's results in this browser's stats. */
export function saveOutcomes(outcomes: Outcome[]) {
  if (outcomes.length > 0) {
    saveNoteStats(recordOutcomes(loadNoteStats(), outcomes));
  }
}
