import { TIMING, type TimingConfig } from "@/config/timing";

/** A note in the chart: which note to play, and when, on the game clock. */
export interface ExpectedNote {
  midi: number;
  targetMs: number;
}

/** A pluck to judge, on the game clock. A null midi means no clear pitch. */
export interface Hit {
  midi: number | null;
  onsetMs: number;
}

export type Rating = "good" | "miss" | "perfect";

/** Why a note was missed. */
export type MissReason = "early" | "late" | "not-played" | "wrong-note";

export interface Judgment {
  /** Position of the note in the chart. */
  index: number;
  /**
   * Hit time minus target time, after the latency offset, in ms. Negative is
   * early, positive is late. Null when nothing was played.
   */
  offsetMs: number | null;
  /** The note that was played, or null when nothing was. */
  playedMidi: number | null;
  rating: Rating;
  /** Why it was a Miss; null for Perfect and Good. */
  reason: MissReason | null;
}

export interface JudgeOptions {
  config?: TimingConfig;
  /**
   * The calibration offset, in ms: how late the system reports a pluck that
   * was played exactly on time. It's subtracted from every hit.
   */
  latencyOffsetMs?: number;
}

/** Perfect, Good, or a Miss marked early or late, from a right note's offset. */
export function rateOffset(
  offsetMs: number,
  config: TimingConfig = TIMING
): Pick<Judgment, "rating" | "reason"> {
  const distance = Math.abs(offsetMs);
  if (distance <= config.perfectWindowMs) {
    return { rating: "perfect", reason: null };
  }
  if (distance <= config.goodWindowMs) {
    return { rating: "good", reason: null };
  }
  return { rating: "miss", reason: offsetMs < 0 ? "early" : "late" };
}

function samePitch(expected: number, played: number, ignoreOctave: boolean) {
  return ignoreOctave ? (expected - played) % 12 === 0 : expected === played;
}

/**
 * Judges plucks against a chart. Feed it every pluck with judgeHit(), and call
 * closeWindows() as time passes so unplayed notes become misses.
 *
 * - A right note within the Perfect or Good window gets that rating. Within
 *   the Miss window, it's a Miss marked early or late.
 * - A wrong note within the Good window of a note is a Miss for that note.
 * - A note nobody played is a Miss once its window has closed.
 * - Plucks with no clear pitch, or nowhere near a note, are ignored.
 */
export function createJudge(
  notes: ExpectedNote[],
  {
    config = TIMING,
    latencyOffsetMs = config.defaultLatencyOffsetMs,
  }: JudgeOptions = {}
) {
  const judgments: (Judgment | undefined)[] = notes.map(() => undefined);

  /**
   * The open note of this pitch nearest to `time`, within the Miss window,
   * and the earliest open note of another pitch within the Good window.
   */
  const findNotes = (midi: number, time: number) => {
    let match: { index: number; offset: number } | null = null;
    let wrong: { index: number; offset: number } | null = null;
    for (const [index, note] of notes.entries()) {
      const offset = time - note.targetMs;
      const open = !judgments[index] && Math.abs(offset) <= config.missWindowMs;
      const right = samePitch(note.midi, midi, config.ignoreOctave);
      if (
        open &&
        right &&
        (!match || Math.abs(offset) < Math.abs(match.offset))
      ) {
        match = { index, offset };
      } else if (
        open &&
        !right &&
        !wrong &&
        Math.abs(offset) <= config.goodWindowMs
      ) {
        wrong = { index, offset };
      }
    }
    return { match, wrong };
  };

  const record = (judgment: Judgment) => {
    judgments[judgment.index] = judgment;
    return judgment;
  };

  return {
    /**
     * Misses every unplayed note whose window closed before `nowMs` (game
     * clock), allowing time for a late pluck to be named. Returns them.
     */
    closeWindows: (nowMs: number): Judgment[] => {
      const closed: Judgment[] = [];
      const deadline =
        nowMs - latencyOffsetMs - config.missWindowMs - config.identifyGraceMs;
      for (const [index, note] of notes.entries()) {
        if (!judgments[index] && note.targetMs < deadline) {
          closed.push(
            record({
              index,
              offsetMs: null,
              playedMidi: null,
              rating: "miss",
              reason: "not-played",
            })
          );
        }
      }
      return closed;
    },

    /** True once every note has a judgment. */
    isComplete: () => judgments.every(Boolean),

    /** Judges one pluck. Returns null if it was ignored. */
    judgeHit: ({ midi, onsetMs }: Hit): Judgment | null => {
      if (midi === null) {
        return null;
      }
      const { match, wrong } = findNotes(midi, onsetMs - latencyOffsetMs);
      if (match) {
        return record({
          index: match.index,
          offsetMs: match.offset,
          playedMidi: midi,
          ...rateOffset(match.offset, config),
        });
      }
      if (wrong) {
        return record({
          index: wrong.index,
          offsetMs: wrong.offset,
          playedMidi: midi,
          rating: "miss",
          reason: "wrong-note",
        });
      }
      return null;
    },

    /** Judgments so far, in chart order; undefined for notes still open. */
    judgments: () => [...judgments],
  };
}

export type Judge = ReturnType<typeof createJudge>;
