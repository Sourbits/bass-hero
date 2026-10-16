export interface CalibrationResult {
  /** Plucks that matched a beat. */
  hits: number;
  /** Suggested latency offset: the median of (pluck − beat), in ms. */
  offsetMs: number;
  /** How consistent the plucks were: the median distance from that offset, in ms. */
  spreadMs: number;
}

export interface CalibrationOptions {
  /** A pluck further than this from every beat is ignored, in ms. */
  matchWindowMs: number;
  /** Fewest matched plucks needed for a suggestion. */
  minHits: number;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/**
 * Suggests a latency offset from plucks played along to a steady beat. Each
 * beat is matched with the nearest unused pluck within the match window. The
 * median ignores the odd stray pluck or flubbed beat.
 *
 * Returns null when too few beats were played to trust the result.
 */
export function suggestLatencyOffset(
  beatTimesMs: number[],
  onsetTimesMs: number[],
  { matchWindowMs, minHits }: CalibrationOptions
): CalibrationResult | null {
  const unused = new Set(onsetTimesMs.keys());
  const offsets: number[] = [];

  for (const beat of beatTimesMs) {
    let nearest: number | null = null;
    for (const index of unused) {
      const distance = Math.abs((onsetTimesMs[index] ?? 0) - beat);
      if (
        distance <= matchWindowMs &&
        (nearest === null ||
          distance < Math.abs((onsetTimesMs[nearest] ?? 0) - beat))
      ) {
        nearest = index;
      }
    }
    if (nearest !== null) {
      unused.delete(nearest);
      offsets.push((onsetTimesMs[nearest] ?? 0) - beat);
    }
  }

  if (offsets.length < minHits) {
    return null;
  }
  const offsetMs = median(offsets);
  return {
    hits: offsets.length,
    offsetMs,
    spreadMs: median(offsets.map((offset) => Math.abs(offset - offsetMs))),
  };
}
