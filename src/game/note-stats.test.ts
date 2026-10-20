import { describe, expect, test } from "bun:test";
import type { Judgment } from "@/timing/judge";
import { scheduleChart } from "./chart";
import {
  type NoteStats,
  outcomesFromRun,
  recordOutcomes,
  WEAK_BELOW,
  weakSpots,
} from "./note-stats";
import { positionKey } from "./positions";

const E3 = { fret: 3, string: "E" as const };
const A2 = { fret: 2, string: "A" as const };

describe("recordOutcomes", () => {
  test("counts tries and hits, and moves mastery toward recent results", () => {
    let stats: NoteStats = {};
    stats = recordOutcomes(stats, [{ hit: true, position: E3 }]);
    expect(stats.E3).toEqual({ attempts: 1, hits: 1, mastery: 0.65 });

    stats = recordOutcomes(stats, [
      { hit: false, position: E3 },
      { hit: false, position: E3 },
    ]);
    expect(stats.E3?.attempts).toBe(3);
    expect(stats.E3?.hits).toBe(1);
    expect(stats.E3?.mastery).toBeLessThan(0.4);
  });

  test("a note played well again and again approaches full mastery", () => {
    const stats = recordOutcomes(
      {},
      Array.from({ length: 12 }, () => ({ hit: true, position: A2 }))
    );

    expect(stats.A2?.mastery).toBeGreaterThan(0.99);
  });

  test("doesn't change the stats it was given", () => {
    const before: NoteStats = {};
    recordOutcomes(before, [{ hit: true, position: E3 }]);

    expect(before).toEqual({});
  });
});

describe("outcomesFromRun", () => {
  test("gives a hit for Perfect and Good, a miss otherwise, and skips unjudged notes", () => {
    const notes = scheduleChart(
      {
        notes: [
          { beat: 0, note: "G1" },
          { beat: 1, note: "B1" },
          { beat: 2, note: "G1" },
        ],
        title: "",
      },
      { bpm: 60, startMs: 0 }
    );
    const judgments: (Judgment | undefined)[] = [
      { index: 0, offsetMs: 0, playedMidi: 31, rating: "good", reason: null },
      {
        index: 1,
        offsetMs: 0,
        playedMidi: 30,
        rating: "miss",
        reason: "wrong-note",
      },
      undefined,
    ];

    expect(
      outcomesFromRun(notes, judgments).map(
        ({ hit, position }) => `${positionKey(position)}:${hit}`
      )
    ).toEqual(["E3:true", "A2:false"]);
  });
});

describe("weakSpots", () => {
  const stats = recordOutcomes({}, [
    { hit: false, position: E3 },
    { hit: false, position: E3 },
    { hit: false, position: A2 },
    ...Array.from({ length: 10 }, () => ({
      hit: true,
      position: { fret: 0, string: "D" as const },
    })),
  ]);

  test("puts the weakest played notes first and leaves out mastered ones", () => {
    expect(weakSpots(stats, []).map(positionKey)).toEqual(["E3", "A2"]);
    expect(stats.D0?.mastery).toBeGreaterThan(WEAK_BELOW);
  });

  test("fills up with notes not played yet", () => {
    const fill = [
      E3,
      { fret: 0, string: "G" as const },
      { fret: 1, string: "E" as const },
    ];

    expect(weakSpots(stats, fill, 3).map(positionKey)).toEqual([
      "E3",
      "A2",
      "G0",
    ]);
  });
});
