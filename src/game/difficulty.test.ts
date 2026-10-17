import { describe, expect, test } from "bun:test";
import { TIER_ORDER, TIERS, type TierId } from "@/config/difficulty";
import { scheduleChart } from "./chart";
import {
  generateLevelChart,
  levelSettings,
  neckDistance,
  starsFor,
  tierPositions,
} from "./difficulty";
import { positionKey, positionName } from "./positions";

const LEVELS = Array.from({ length: 10 }, (_, index) => index + 1);

function runOf(tier: TierId, level: number, seed: number) {
  return scheduleChart(generateLevelChart({ level, tier }, { seed }), {
    bpm: 60,
    startMs: 0,
  });
}

function averageJump(tier: TierId, level: number) {
  let total = 0;
  let count = 0;
  for (let seed = 1; seed <= 20; seed += 1) {
    const notes = runOf(tier, level, seed);
    for (let index = 1; index < notes.length; index += 1) {
      const [before, after] = [notes[index - 1], notes[index]];
      if (before && after) {
        total += neckDistance(before, after);
        count += 1;
      }
    }
  }
  return total / count;
}

describe("tiers", () => {
  test("Easy is the natural notes on E and A, frets 0 to 3", () => {
    expect(tierPositions("easy").map(positionName)).toEqual([
      "E1",
      "F1",
      "G1",
      "A1",
      "B1",
      "C2",
    ]);
  });

  test("each tier adds strings or frets", () => {
    const sizes = TIER_ORDER.map((tier) => tierPositions(tier).length);

    expect(sizes).toEqual([6, 16, 52]);
    expect(
      tierPositions("medium").every((position) => position.fret <= 5)
    ).toBe(true);
    expect(
      tierPositions("medium").some((position) =>
        positionName(position).includes("#")
      )
    ).toBe(false);
    expect(
      tierPositions("hard").some((position) =>
        positionName(position).includes("#")
      )
    ).toBe(true);
  });

  test("help fades as the tiers get harder", () => {
    expect(TIER_ORDER.map((tier) => TIERS[tier].showFretHints)).toEqual([
      true,
      false,
      false,
    ]);
    expect(TIER_ORDER.map((tier) => TIERS[tier].showFretboard)).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("levelSettings", () => {
  test("speeds up from level 1 to level 10", () => {
    for (const tier of TIER_ORDER) {
      const tempos = LEVELS.map((level) => levelSettings({ level, tier }).bpm);
      expect(tempos[0]).toBe(TIERS[tier].bpm[0]);
      expect(tempos[9]).toBe(TIERS[tier].bpm[1]);
      expect(tempos).toEqual([...tempos].sort((a, b) => a - b));
    }
  });

  test("lets notes jump further, and from level 6 makes them", () => {
    const settings = LEVELS.map((level) =>
      levelSettings({ level, tier: "medium" })
    );
    const maxJumps = settings.map((setting) => setting.maxJump);
    const minJumps = settings.map((setting) => setting.minJump);

    expect(maxJumps).toEqual([...maxJumps].sort((a, b) => a - b));
    expect(maxJumps[0]).toBe(2);
    expect(minJumps.slice(0, 2)).toEqual([0, 0]);
    expect(minJumps.slice(2, 5)).toEqual([1, 1, 1]);
    expect(minJumps).toEqual([...minJumps].sort((a, b) => a - b));
    expect(minJumps[9]).toBeGreaterThan(2);
  });
});

describe("generateLevelChart", () => {
  test("makes a run of the tier's notes, within each level's jump range", () => {
    for (const tier of TIER_ORDER) {
      const allowed = new Set(tierPositions(tier).map(positionKey));
      for (const level of LEVELS) {
        const { maxJump, minJump, notes } = levelSettings({ level, tier });
        const run = runOf(tier, level, level * 7);

        expect(run).toHaveLength(notes);
        for (const [index, note] of run.entries()) {
          expect(allowed.has(positionKey(note))).toBe(true);
          const before = run[index - 1];
          if (before) {
            const jump = neckDistance(before, note);
            expect(jump).toBeGreaterThanOrEqual(minJump);
            expect(jump).toBeLessThanOrEqual(maxJump);
          }
        }
      }
    }
  });

  test("moves around the neck more at higher levels", () => {
    for (const tier of TIER_ORDER) {
      const low = averageJump(tier, 1);
      const middle = averageJump(tier, 5);
      const high = averageJump(tier, 10);

      expect(middle).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(middle);
    }
  });

  test("covers most of the tier's notes over a run", () => {
    const used = new Set(runOf("medium", 5, 3).map(positionKey));

    expect(used.size).toBeGreaterThanOrEqual(10);
  });

  test("gives the same run for the same seed", () => {
    expect(generateLevelChart({ level: 4, tier: "hard" }, { seed: 9 })).toEqual(
      generateLevelChart({ level: 4, tier: "hard" }, { seed: 9 })
    );
  });

  test("names the run after its level", () => {
    expect(generateLevelChart({ level: 3, tier: "easy" }).title).toBe("Easy 3");
  });
});

describe("starsFor", () => {
  test("gives 0 to 3 stars by hit rate", () => {
    expect([0.5, 0.6, 0.85, 0.95, 1].map(starsFor)).toEqual([0, 1, 2, 3, 3]);
  });
});
