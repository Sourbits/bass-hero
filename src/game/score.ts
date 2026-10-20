import { COMBO, SCORING } from "@/config/timing";
import type { Judgment, Rating } from "@/timing/judge";

export interface ScoreSummary {
  /** Mean offset of Perfect and Good hits, in ms; null if there were none. */
  averageOffsetMs: number | null;
  counts: Record<Rating, number>;
  /** True once at least one note is judged and none was a Miss. */
  fullCombo: boolean;
  /** Judged notes so far. */
  judged: number;
  /** The longest run of hits in a row. */
  maxStreak: number;
  /** The multiplier the next hit will get. */
  multiplier: number;
  /** Points, with each hit multiplied by the combo multiplier at the time. */
  score: number;
  /** Hits in a row right now. */
  streak: number;
}

/** The multiplier for a hit that comes after `streak` hits in a row. */
export function multiplierFor(streak: number, combo = COMBO) {
  return Math.min(
    combo.maxMultiplier,
    1 + Math.floor(streak / combo.notesPerStep)
  );
}

/**
 * Adds up judgments, ignoring notes not judged yet, so it works for the
 * running score as well as the final one.
 *
 * Combos follow the order notes were judged in, given by `order` (indexes
 * into `judgments`); without it, chart order.
 */
export function summarize(
  judgments: (Judgment | undefined)[],
  order?: number[],
  points = SCORING
): ScoreSummary {
  const counts: Record<Rating, number> = { good: 0, miss: 0, perfect: 0 };
  const hitOffsets: number[] = [];
  let score = 0;
  let streak = 0;
  let maxStreak = 0;

  const sequence = order ?? judgments.map((_, index) => index);
  for (const index of sequence) {
    const judgment = judgments[index];
    if (!judgment) {
      continue;
    }
    counts[judgment.rating] += 1;
    if (judgment.rating === "miss") {
      streak = 0;
      continue;
    }
    score += points[judgment.rating] * multiplierFor(streak);
    streak += 1;
    maxStreak = Math.max(maxStreak, streak);
    if (judgment.offsetMs !== null) {
      hitOffsets.push(judgment.offsetMs);
    }
  }

  const judged = counts.perfect + counts.good + counts.miss;
  return {
    averageOffsetMs:
      hitOffsets.length > 0
        ? hitOffsets.reduce((sum, offset) => sum + offset, 0) /
          hitOffsets.length
        : null,
    counts,
    fullCombo: judged > 0 && counts.miss === 0,
    judged,
    maxStreak,
    multiplier: multiplierFor(streak),
    score,
    streak,
  };
}
