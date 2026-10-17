import { describe, expect, test } from "bun:test";
import type { Judgment } from "@/timing/judge";
import { scheduleChart } from "./chart";
import { hitRate, missedNotes } from "./review";

const notes = scheduleChart(
  {
    notes: [
      { beat: 0, note: "E1" },
      { beat: 1, note: "F1" },
      { beat: 2, note: "F1" },
      { beat: 3, note: "G1" },
    ],
    title: "",
  },
  { bpm: 60, startMs: 0 }
);

const judged = (
  index: number,
  rating: Judgment["rating"],
  reason: Judgment["reason"] = null
): Judgment => ({ index, offsetMs: 0, playedMidi: null, rating, reason });

describe("missedNotes", () => {
  test("lists missed notes, most-missed first, with why", () => {
    const missed = missedNotes(notes, [
      judged(0, "perfect"),
      judged(1, "miss", "wrong-note"),
      judged(2, "miss", "buzz"),
      judged(3, "miss", "not-played"),
    ]);

    expect(missed).toEqual([
      {
        count: 2,
        name: "F1",
        position: { fret: 1, string: "E" },
        reasons: ["wrong-note", "buzz"],
      },
      {
        count: 1,
        name: "G1",
        position: { fret: 3, string: "E" },
        reasons: ["not-played"],
      },
    ]);
  });

  test("is empty after a clean run", () => {
    expect(
      missedNotes(
        notes,
        notes.map((_, index) => judged(index, "good"))
      )
    ).toEqual([]);
  });
});

describe("hitRate", () => {
  test("counts Perfect and Good out of every note", () => {
    expect(
      hitRate([judged(0, "perfect"), judged(1, "good"), judged(2, "miss")], 4)
    ).toBe(0.5);
    expect(hitRate([], 0)).toBe(0);
  });
});
