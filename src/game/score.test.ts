import { describe, expect, test } from "bun:test";
import { COMBO } from "@/config/timing";
import type { Judgment, Rating } from "@/timing/judge";
import { multiplierFor, summarize } from "./score";

const judged = (rating: Rating, index = 0): Judgment => ({
  index,
  offsetMs: 0,
  playedMidi: 28,
  rating,
  reason: rating === "miss" ? "not-played" : null,
});

const run = (ratings: Rating[]) =>
  ratings.map((rating, index) => judged(rating, index));

describe("multiplierFor", () => {
  test("goes up one step every 10 hits in a row, to ×4", () => {
    expect(
      [0, 9, 10, 19, 20, 30, 99].map((streak) => multiplierFor(streak))
    ).toEqual([1, 1, 2, 2, 3, 4, 4]);
    expect(COMBO.maxMultiplier).toBe(4);
  });
});

describe("summarize with combos", () => {
  test("multiplies each hit by the combo at the time", () => {
    // 25 Perfects: 10 at ×1, 10 at ×2, 5 at ×3.
    const summary = summarize(run(new Array(25).fill("perfect")));

    expect(summary.score).toBe(10 * 100 + 10 * 200 + 5 * 300);
    expect(summary.streak).toBe(25);
    expect(summary.multiplier).toBe(3);
    expect(summary.fullCombo).toBe(true);
  });

  test("a Miss resets the streak and the multiplier", () => {
    const summary = summarize(
      run([...new Array(12).fill("perfect"), "miss", "good"])
    );

    expect(summary.streak).toBe(1);
    expect(summary.maxStreak).toBe(12);
    expect(summary.multiplier).toBe(1);
    expect(summary.fullCombo).toBe(false);
    // 10 at ×1, 2 at ×2, then a Good at ×1.
    expect(summary.score).toBe(1000 + 400 + 50);
  });

  test("follows the order notes were judged in", () => {
    // Note 0 is called unplayed after notes 1 and 2 were already hit.
    const judgments = run(["miss", "perfect", "perfect"]);

    expect(summarize(judgments, [1, 2, 0]).streak).toBe(0);
    expect(summarize(judgments, [1, 2, 0]).maxStreak).toBe(2);
    expect(summarize(judgments).streak).toBe(2);
  });

  test("starts with nothing judged and no full combo", () => {
    expect(summarize([])).toMatchObject({
      fullCombo: false,
      multiplier: 1,
      score: 0,
      streak: 0,
    });
  });
});
