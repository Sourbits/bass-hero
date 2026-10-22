import type { TimingConfig } from "@/config/timing";
import type { ScheduledNote } from "@/game/chart";
import type { Level } from "@/game/difficulty";
import type { ScoreSummary } from "@/game/score";
import type { PlayedNote } from "@/onset/played-notes";
import type { Judgment } from "@/timing/judge";
import { debugLog, r } from "./debug-log";

/** "E1 (E string, open)": a charted note, as the log shows it. */
function expected(note: ScheduledNote | undefined) {
  if (!note) {
    return null;
  }
  const where = note.fret === 0 ? "open" : `fret ${note.fret}`;
  return `${note.name} (${note.string} string, ${where})`;
}

function judgmentFields(judgment: Judgment, notes: ScheduledNote[]) {
  const note = notes[judgment.index];
  return {
    expected: expected(note),
    index: judgment.index,
    offsetMs: r(judgment.offsetMs),
    rating: judgment.rating,
    reason: judgment.reason,
    targetMs: r(note?.targetMs),
  };
}

/** A run starting: what it will play, how fast, and how it judges. */
export function logRunStart({
  bpm,
  config,
  demo,
  guideTone,
  latencyOffsetMs,
  level,
  mode,
  notes,
}: {
  bpm: number;
  config: TimingConfig;
  demo: boolean;
  guideTone: boolean;
  latencyOffsetMs: number;
  level: Level | null;
  mode: string;
  notes: ScheduledNote[];
}) {
  debugLog("run-start", {
    bpm,
    demo,
    guideTone,
    latencyOffsetMs,
    level: level ? `${level.tier} ${level.level}` : null,
    mode,
    notes: notes.map((note, index) => ({
      index,
      note: expected(note),
      targetMs: r(note.targetMs),
    })),
    timing: {
      buzzThresholdDb: config.buzzThresholdDb,
      countBuzz: config.countBuzz,
      goodWindowMs: config.goodWindowMs,
      perfectWindowMs: config.perfectWindowMs,
    },
  });
}

/**
 * A pluck the game heard: when, which note, how buzzy, how loud, and how
 * it was judged (or that no note was near enough to judge it against).
 */
export function logPluck(
  played: PlayedNote,
  judgment: Judgment | null,
  notes: ScheduledNote[]
) {
  const { buzzDb, note, onsetMs, peak } = played;
  debugLog("pluck", {
    buzzDb: r(buzzDb),
    cents: r(note?.cents, 0),
    heard: note ? `${note.name}${note.octave}` : null,
    hz: r(note?.frequency, 2),
    judged: judgment ? judgmentFields(judgment, notes) : "no note near enough",
    onsetMs: r(onsetMs),
    peak: r(peak, 3),
  });
}

/** Notes whose time passed without a matching pluck. */
export function logUnplayed(judgments: Judgment[], notes: ScheduledNote[]) {
  for (const judgment of judgments) {
    debugLog("not-played", judgmentFields(judgment, notes));
  }
}

/** A run ending, with its totals. */
export function logRunEnd(summary: ScoreSummary, total: number) {
  debugLog("run-end", {
    averageOffsetMs: r(summary.averageOffsetMs),
    counts: summary.counts,
    maxStreak: summary.maxStreak,
    score: summary.score,
    total,
  });
}
