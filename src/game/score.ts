import { SCORING } from "@/config/timing";
import type { Judgment, Rating } from "@/timing/judge";

export interface ScoreSummary {
  /** Mean offset of Perfect and Good hits, in ms; null if there were none. */
  averageOffsetMs: number | null;
  counts: Record<Rating, number>;
  /** Judged notes so far. */
  judged: number;
  score: number;
}

/**
 * Adds up judgments, ignoring notes not judged yet, so it works for the
 * running score as well as the final one.
 */
export function summarize(
  judgments: (Judgment | undefined)[],
  points = SCORING
): ScoreSummary {
  const counts: Record<Rating, number> = { good: 0, miss: 0, perfect: 0 };
  const hitOffsets: number[] = [];

  for (const judgment of judgments) {
    if (!judgment) {
      continue;
    }
    counts[judgment.rating] += 1;
    if (judgment.rating !== "miss" && judgment.offsetMs !== null) {
      hitOffsets.push(judgment.offsetMs);
    }
  }

  return {
    averageOffsetMs:
      hitOffsets.length > 0
        ? hitOffsets.reduce((sum, offset) => sum + offset, 0) /
          hitOffsets.length
        : null,
    counts,
    judged: counts.perfect + counts.good + counts.miss,
    score:
      counts.perfect * points.perfect +
      counts.good * points.good +
      counts.miss * points.miss,
  };
}
