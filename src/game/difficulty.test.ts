import { describe, expect, test } from "bun:test";
import { TIER_ORDER, TIERS, type TierId } from "@/config/difficulty";
import { scheduleChart } from "./chart";
import {
  generateLevelChart,
  type Level,
  levelSettings,
  neckDistance,
  notesPerMinute,
  starsFor,
  tierPositions,
} from "./difficulty";
import { positionKey, positionName } from "./positions";

const LEVELS = Array.from({ length: 10 }, (_, index) => index + 1);
const EVERY_LEVEL: Level[] = TIER_ORDER.flatMap((tier) =>
  LEVELS.map((level) => ({ level, tier }))
);

function runOf(level: Level, seed: number) {
  return scheduleChart(generateLevelChart(level, { seed }), {
    bpm: 60,
    startMs: 0,
  });
}

function averageJump(level: Level) {
  let total = 0;
  let count = 0;
  for (let seed = 1; seed <= 20; seed += 1) {
    const notes = runOf(level, seed);
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

const keys = (level: Level) => levelSettings(level).positions.map(positionKey);

describe("the start of the curve", () => {
  test("Easy 1 is the open E and A strings, slowly, every other beat", () => {
    const settings = levelSettings({ level: 1, tier: "easy" });

    expect(settings.positions.map(positionName)).toEqual(["E1", "A1"]);
    expect(settings.bpm).toBe(50);
    expect(settings.beatsPerNote).toBe(2);
    expect(settings.notes).toBe(10);
    expect(settings.showFretHints).toBe(true);
  });
});

describe("the whole curve", () => {
  test("never gets slower, from Easy 1 to Demon 10", () => {
    const paces = EVERY_LEVEL.map(notesPerMinute);

    expect(paces).toEqual([...paces].sort((a, b) => a - b));
    expect(paces[0]).toBe(25);
    expect(paces.at(-1)).toBe(300);
  });

  test("each tier starts with every note the tier before ended with", () => {
    for (const [index, tier] of TIER_ORDER.entries()) {
      const before = TIER_ORDER[index - 1];
      if (before) {
        const start = new Set(keys({ level: 1, tier }));
        for (const key of keys({ level: 10, tier: before })) {
          expect(start.has(key)).toBe(true);
        }
      }
    }
  });

  test("never asks for notes closer than 150 ms, which detection needs", () => {
    for (const level of EVERY_LEVEL) {
      const { beatsPerNote, bpm } = levelSettings(level);
      expect((60_000 / bpm) * beatsPerNote).toBeGreaterThanOrEqual(150);
    }
  });

  test("help fades as the tiers get harder", () => {
    expect(TIER_ORDER.map((tier) => TIERS[tier].showFretHints)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(TIER_ORDER.map((tier) => TIERS[tier].showFretboard)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("tiers", () => {
  test("pools have no repeats and stay on the neck", () => {
    for (const tier of TIER_ORDER) {
      const pool = tierPositions(tier);
      expect(new Set(pool.map(positionKey)).size).toBe(pool.length);
      for (const position of pool) {
        expect(position.fret).toBeGreaterThanOrEqual(0);
        expect(position.fret).toBeLessThanOrEqual(12);
      }
    }
  });

  test("sharps only arrive in Hard", () => {
    const hasSharps = (tier: TierId) =>
      tierPositions(tier).some((position) =>
        positionName(position).includes("#")
      );

    expect(TIER_ORDER.map(hasSharps)).toEqual([false, false, true, true]);
  });

  test("Demon is every note to the 12th fret, two per beat, with tighter timing", () => {
    const settings = levelSettings({ level: 1, tier: "demon" });

    expect(settings.positions).toHaveLength(52);
    expect(settings.beatsPerNote).toBe(0.5);
    expect(settings.timing?.perfectWindowMs).toBeLessThan(50);
    expect(settings.timing?.goodWindowMs).toBeLessThan(120);
  });
});

describe("levelSettings", () => {
  test("level 1 of a tier only calls new what earlier tiers didn't have", () => {
    expect(levelSettings({ level: 1, tier: "easy" }).newPositions).toHaveLength(
      2
    );
    expect(levelSettings({ level: 1, tier: "medium" }).newPositions).toEqual(
      []
    );
    expect(levelSettings({ level: 1, tier: "hard" }).newPositions).toEqual([]);
    expect(
      levelSettings({ level: 1, tier: "demon" }).newPositions
    ).toHaveLength(52 - TIERS.hard.pool.length);
  });

  test("each level adds notes, and says which ones are new", () => {
    for (const tier of TIER_ORDER) {
      for (const level of LEVELS.slice(1)) {
        const before = keys({ level: level - 1, tier });
        const now = levelSettings({ level, tier });
        const added = now.newPositions.map(positionKey);

        expect(now.positions.length).toBeGreaterThanOrEqual(before.length);
        expect([...before, ...added]).toEqual(now.positions.map(positionKey));
      }
      expect(keys({ level: 10, tier })).toHaveLength(TIERS[tier].pool.length);
    }
  });

  test("speeds up and packs notes closer within each tier", () => {
    for (const tier of TIER_ORDER) {
      const settings = LEVELS.map((level) => levelSettings({ level, tier }));
      const tempos = settings.map((setting) => setting.bpm);
      const spacing = settings.map((setting) => setting.beatsPerNote);

      expect(tempos).toEqual([...tempos].sort((a, b) => a - b));
      expect(spacing).toEqual([...spacing].sort((a, b) => b - a));
    }
  });

  test("Easy goes from every other beat to every beat", () => {
    expect(levelSettings({ level: 10, tier: "easy" }).beatsPerNote).toBe(1);
  });
});

describe("generateLevelChart", () => {
  test("makes a run of the level's notes, within its jump range and spacing", () => {
    for (const level of EVERY_LEVEL) {
      const settings = levelSettings(level);
      const allowed = new Set(settings.positions.map(positionKey));
      const run = runOf(level, level.level * 7);

      expect(run).toHaveLength(settings.notes);
      for (const [index, note] of run.entries()) {
        expect(allowed.has(positionKey(note))).toBe(true);
        expect(note.beat).toBe(index * settings.beatsPerNote);
        const before = run[index - 1];
        if (before) {
          const jump = neckDistance(before, note);
          expect(jump).toBeGreaterThanOrEqual(settings.minJump);
          expect(jump).toBeLessThanOrEqual(settings.maxJump);
        }
      }
    }
  });

  test("moves around the neck more at the top of each tier", () => {
    for (const tier of TIER_ORDER) {
      expect(averageJump({ level: 10, tier })).toBeGreaterThan(
        averageJump({ level: 1, tier })
      );
    }
  });

  test("gives the same run for the same seed", () => {
    const level = { level: 4, tier: "hard" as const };

    expect(generateLevelChart(level, { seed: 9 })).toEqual(
      generateLevelChart(level, { seed: 9 })
    );
  });

  test("names the run after its level", () => {
    expect(generateLevelChart({ level: 3, tier: "demon" }).title).toBe(
      "Demon 3"
    );
  });
});

describe("starsFor", () => {
  test("gives 0 to 3 stars by hit rate", () => {
    expect([0.5, 0.6, 0.85, 0.95, 1].map(starsFor)).toEqual([0, 1, 2, 3, 3]);
  });
});
