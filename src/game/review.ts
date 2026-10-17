import type { Judgment, MissReason } from "@/timing/judge";
import type { ScheduledNote } from "./chart";
import { type Position, positionKey } from "./positions";

export interface MissedNote {
  /** How many times it was missed in the run. */
  count: number;
  name: string;
  position: Position;
  reasons: MissReason[];
}

/** The notes missed in a run, most-missed first: the ones to practice. */
export function missedNotes(
  notes: ScheduledNote[],
  judgments: (Judgment | undefined)[]
): MissedNote[] {
  const byPosition = new Map<string, MissedNote>();
  for (const [index, note] of notes.entries()) {
    const judgment = judgments[index];
    if (judgment?.rating !== "miss") {
      continue;
    }
    const key = positionKey(note);
    const entry = byPosition.get(key) ?? {
      count: 0,
      name: note.name,
      position: { fret: note.fret, string: note.string },
      reasons: [],
    };
    entry.count += 1;
    if (judgment.reason && !entry.reasons.includes(judgment.reason)) {
      entry.reasons.push(judgment.reason);
    }
    byPosition.set(key, entry);
  }
  return [...byPosition.values()].sort((a, b) => b.count - a.count);
}

/** Share of notes hit (Perfect or Good), from 0 to 1. */
export function hitRate(judgments: (Judgment | undefined)[], total: number) {
  if (total === 0) {
    return 0;
  }
  const hits = judgments.filter(
    (judgment) => judgment && judgment.rating !== "miss"
  ).length;
  return hits / total;
}
