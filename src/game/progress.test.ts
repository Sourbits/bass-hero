import { describe, expect, test } from "bun:test";
import { levelKey, NEW_PROGRESS, nextLevel, recordRun } from "./progress";

describe("recordRun", () => {
  test("keeps the best hit rate, score and stars for each level", () => {
    const level = { level: 2, tier: "easy" as const };
    const first = recordRun(NEW_PROGRESS, level, {
      hitRate: 0.85,
      score: 1200,
    });
    const worse = recordRun(first, level, { hitRate: 0.5, score: 1500 });

    expect(worse.records[levelKey(level)]).toEqual({
      bestHitRate: 0.85,
      bestScore: 1500,
      stars: 2,
    });
  });

  test("doesn't change the progress it was given", () => {
    recordRun(
      NEW_PROGRESS,
      { level: 1, tier: "hard" },
      { hitRate: 1, score: 1 }
    );

    expect(NEW_PROGRESS.records).toEqual({});
  });
});

describe("nextLevel", () => {
  test("goes up a level, then on to the next tier", () => {
    expect(nextLevel({ level: 3, tier: "easy" })).toEqual({
      level: 4,
      tier: "easy",
    });
    expect(nextLevel({ level: 10, tier: "easy" })).toEqual({
      level: 1,
      tier: "medium",
    });
    expect(nextLevel({ level: 10, tier: "hard" })).toEqual({
      level: 1,
      tier: "demon",
    });
    expect(nextLevel({ level: 10, tier: "demon" })).toBeNull();
  });
});
